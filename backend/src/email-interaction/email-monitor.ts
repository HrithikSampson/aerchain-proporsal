import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import config from '../config/config';
import AppDataSource from '../data-source';
import { RFP } from '../entity/RFP';
import { Vendor } from '../entity/Vendor';
import { RfpProposal } from '../entity/RfpProporsal';
import { parseVendorProposalEmail } from '../ai-interaction/proposal-email-parser';
import { RfpProposalBuilder } from '../zod-schema/RfpProporsal';

class EmailMonitor {
  private client: ImapFlow | null = null;
  private isRunning = false;
  private reconnectDelay = 5000;
  private maxReconnectDelay = 60000;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 2 * 60 * 1000;

  async start() {
    if (this.isRunning) {
      console.log('Email monitor is already running');
      return;
    }

    this.isRunning = true;
    await this.connect();
  }

  private async connect() {
    try {
      console.log('Connecting to Gmail IMAP...');

      this.client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
          user: config.EMAIL_ADDRESS,
          pass: config.EMAIL_PASSWORD,
        },
        logger: false,
      });

      this.client.on('error', (err) => {
        console.error('IMAP error:', err);
      });

      this.client.on('close', () => {
        console.log('IMAP connection closed');
        if (this.isRunning) {
          this.scheduleReconnect();
        }
      });

      await this.client.connect();
      console.log('Connected to Gmail IMAP successfully');

      await this.monitorInbox();
      this.startIntervalCheck();
    } catch (error) {
      console.error('Failed to connect to IMAP:', error);
      if (this.isRunning) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect() {
    console.log(`Reconnecting in ${this.reconnectDelay / 1000} seconds...`);
    setTimeout(() => {
      if (this.isRunning) {
        this.connect();
      }
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private async monitorInbox() {
    if (!this.client) return;

    try {
      const lock = await this.client.getMailboxLock('INBOX');

      try {
        console.log('Monitoring INBOX for new emails...');

        await this.processUnseenEmails();

        for await (const message of this.client.fetch('*', {
          source: true,
          flags: true,
          envelope: true,
        }, { uid: true })) {
          if (!message.flags?.has('\\Seen')) {
            await this.processEmail(message);
          }
        }

        this.client.on('exists', async () => {
          console.log('New email detected');
          await this.processUnseenEmails();
        });

      } finally {
        lock.release();
      }

      this.reconnectDelay = 5000;
    } catch (error) {
      console.error('Error monitoring inbox:', error);
      if (this.isRunning) {
        this.scheduleReconnect();
      }
    }
  }

  private async processUnseenEmails() {
    if (!this.client) return;

    try {
      const unseenUids = await this.client.search({ seen: false }, { uid: true });

      if (!unseenUids || unseenUids.length === 0) {
        return;
      }

      for await (const message of this.client.fetch(unseenUids, {
        source: true,
        flags: true,
        envelope: true,
      }, { uid: true })) {
        await this.processEmail(message);
      }
    } catch (error) {
      console.error('Error processing unseen emails:', error);
    }
  }

  private async processEmail(message: any) {
    try {
      const parsed = await simpleParser(message.source);

      const subject = parsed.subject || '';
      const from = parsed.from?.text || '';
      const textContent = parsed.text || '';
      const htmlContent = parsed.html || '';

      console.log(`Processing email from: ${from}, subject: ${subject}`);

      const rfpId = this.extractRfpId(subject, textContent);

      if (!rfpId) {
        console.log('No RFP ID found in email, skipping...');
        console.log(`Subject was: "${subject}"`);
        console.log(`Body preview: "${textContent.substring(0, 200)}"`);
        return;
      }

      console.log(`Extracted RFP ID: ${rfpId}`);

      const vendorEmail = this.extractEmail(from);

      if (!vendorEmail) {
        console.log('Could not extract vendor email, skipping...');
        return;
      }

      const emailContent = htmlContent || textContent;

      await this.saveProposal(rfpId, vendorEmail, emailContent);

      if (this.client && message.uid) {
        await this.client.messageFlagsAdd([message.uid], ['\\Seen'], { uid: true });
        console.log('Marked email as read');
      }

    } catch (error) {
      console.error('Error processing email:', error);
    }
  }

  private extractRfpId(subject: string, body: string): string | null {
    const patterns = [
      /RFP Request - ID:\s*([a-f0-9-]+)/i,
      /RFPID\s*[:\s]+([a-f0-9-]+)/i,
      /RFP[-\s]?ID[:\s]+([a-f0-9-]+)/i,
      /Re:.*RFP Request - ID:\s*([a-f0-9-]+)/i,
      /Re:.*RFPID\s*[:\s]+([a-f0-9-]+)/i,
      /RFP[:\s]+([a-f0-9-]{36})/i,
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
    ];

    for (const pattern of patterns) {
      const subjectMatch = subject.match(pattern);
      if (subjectMatch) {
        return subjectMatch[1];
      }
    }

    for (const pattern of patterns) {
      const bodyMatch = body.match(pattern);
      if (bodyMatch) {
        return bodyMatch[1];
      }
    }

    return null;
  }

  private extractEmail(from: string): string | null {
    const emailMatch = from.match(/[\w.-]+@[\w.-]+\.\w+/);
    return emailMatch ? emailMatch[0] : null;
  }

  private async saveProposal(rfpId: string, vendorEmail: string, emailContent: string) {
    try {
      const rfpRepo = AppDataSource.getRepository(RFP);
      const vendorRepo = AppDataSource.getRepository(Vendor);
      const proposalRepo = AppDataSource.getRepository(RfpProposal);

      const rfp = await rfpRepo.findOne({ where: { id: rfpId } });

      if (!rfp) {
        console.error(`RFP not found: ${rfpId}`);
        return;
      }

      let vendor = await vendorRepo.findOne({ where: { email: vendorEmail } });

      if (!vendor) {
        vendor = vendorRepo.create({ email: vendorEmail });
        await vendorRepo.save(vendor);
        console.log(`Created new vendor: ${vendorEmail}`);
      }

      console.log('Parsing proposal email with AI...');
      const { proposalData, isComplete, missingFields } = await parseVendorProposalEmail(emailContent);

      if (!isComplete) {
        console.warn('Incomplete proposal data:', { missingFields, proposalData });
        console.log('Attempting to save partial proposal...');
      }

      const builder = new RfpProposalBuilder(proposalData);

      let completeProposal;
      try {
        completeProposal = builder.build();
      } catch (error) {
        console.error('Failed to build complete proposal:', error);
        completeProposal = {
          budgetAmount: proposalData.budgetAmount || 0,
          budgetCurrency: proposalData.budgetCurrency || 'USD',
          items: proposalData.items || [],
          notes: proposalData.notes || 'Incomplete proposal - manual review required',
          extraItems: proposalData.extraItems || {},
        };
      }

      const proposal = proposalRepo.create({
        budgetAmount: completeProposal.budgetAmount.toString(),
        budgetCurrency: completeProposal.budgetCurrency,
        items: completeProposal.items,
        notes: completeProposal.notes || null,
        extraItems: (completeProposal.extraItems || {}) as Record<string, string>,
        rfp,
        vendor,
      });

      await proposalRepo.save(proposal);

      console.log(`Saved proposal from ${vendorEmail} for RFP ${rfpId}`);
      console.log(`Proposal ID: ${proposal.id}, Items: ${proposal.items.length}, Budget: ${proposal.budgetCurrency} ${proposal.budgetAmount}`);

    } catch (error) {
      console.error('Error saving proposal:', error);
    }
  }

  private startIntervalCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    console.log(`Starting interval email check every ${this.CHECK_INTERVAL_MS / 60000} minutes`);

    this.checkInterval = setInterval(async () => {
      console.log('Running scheduled email check...');
      try {
        await this.processUnseenEmails();
      } catch (error) {
        console.error('Error during scheduled email check:', error);
      }
    }, this.CHECK_INTERVAL_MS);
  }

  async stop() {
    console.log('Stopping email monitor...');
    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.client) {
      try {
        await this.client.logout();
      } catch (error) {
        console.error('Error during logout:', error);
      }
      this.client = null;
    }

    console.log('Email monitor stopped');
  }
}

export const emailMonitor = new EmailMonitor();
