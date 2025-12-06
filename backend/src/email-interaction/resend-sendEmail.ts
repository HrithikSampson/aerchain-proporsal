import { Resend } from 'resend';
import { z } from 'zod';
import config from '../config/config';

const resend = new Resend(config.RESEND_API_KEY);
const EmailSchema = z.string().email();
export type Email = z.infer<typeof EmailSchema>;

interface RfpEmailData {
  rfpId: string;
  user_input: string;
  budgetAmount: string;
  budgetCurrency: string;
  proporsalFinalisingEndDate?: number | null;
  items?: any[];
  extraItems?: {[key: string]: any};
}

async function sendEmail(emailList: Email[], rfpLink: string, body: {[key: string]: any}  ) {
    await resend.emails.send({
        from: "aerassignment@gmail.com",
        to: emailList,
        subject: `RFP from ${rfpLink}`,
        html: "<p>You have received a new RFP. Please find the details below:</p>" +
            `<p>${JSON.stringify(body, null, 2)}</p>` +
            `<p>Access the RFP here: <a href="${rfpLink}">${rfpLink}</a></p>`,
    });
}

async function sendRfpToVendors(emailList: Email[], rfpData: RfpEmailData, rfpLink: string) {
    const itemsTable = rfpData.items && rfpData.items.length > 0
        ? `
        <h3>Items Requested:</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background-color: #f4f4f4;">
              <th>Item Name</th>
              <th>Category</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            ${rfpData.items.map(item => `
              <tr>
                <td>${item.itemName || item.name || 'N/A'}</td>
                <td>${item.category || 'N/A'}</td>
                <td>${item.quantity || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `
        : '';

    const deadline = rfpData.proporsalFinalisingEndDate
        ? new Date(rfpData.proporsalFinalisingEndDate).toLocaleDateString()
        : 'Not specified';

    try {
        const result = await resend.emails.send({
            from: "onboarding@resend.dev",
            to: emailList,
            subject: `RFP Request - ID: ${rfpData.rfpId}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <h2>Request for Proposal</h2>
            <p><strong>RFP ID:</strong> ${rfpData.rfpId}</p>
            <p style="font-style: italic; color: #666;">Please include this ID in your reply</p>

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

            <h3>Description:</h3>
            <p>${rfpData.user_input}</p>

            <h3>Budget:</h3>
            <p>${rfpData.budgetCurrency} ${parseFloat(rfpData.budgetAmount).toLocaleString()}</p>

            <h3>Proposal Deadline:</h3>
            <p>${deadline}</p>

            ${itemsTable}

            ${rfpData.extraItems && Object.keys(rfpData.extraItems).length > 0 ? `
              <h3>Additional Information:</h3>
              <ul>
                ${Object.entries(rfpData.extraItems).map(([key, value]) => `
                  <li><strong>${key}:</strong> ${value}</li>
                `).join('')}
              </ul>
            ` : ''}

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

            <h3>How to Submit Your Proposal:</h3>
            <p>To submit your proposal, please reply to this email with your quote including:</p>
            <ul>
              <li>Total budget and currency</li>
              <li>Breakdown of items with unit prices</li>
              <li>Any additional notes or terms</li>
            </ul>

            <p>You can also access the RFP online: <a href="${rfpLink}" style="color: #0066cc;">${rfpLink}</a></p>

            <p style="margin-top: 30px; color: #666; font-size: 12px;">
              This is an automated message. Please do not reply directly to this email unless submitting a proposal.
            </p>
          </div>
        `,
        });

        console.log(`Email sent successfully to ${emailList.length} vendor(s):`, result);
        return result;
    } catch (error) {
        console.error("Failed to send email via Resend:", error);
        throw error;
    }
}

export { sendEmail, sendRfpToVendors, EmailSchema };
