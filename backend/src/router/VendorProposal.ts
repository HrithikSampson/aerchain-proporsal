import { Router, Request, Response } from "express";
import AppDataSource from "../data-source";
import { RFP } from "../entity/RFP";
import { Vendor } from "../entity/Vendor";
import { RfpProposal } from "../entity/RfpProporsal";
import { parseVendorProposalEmail } from "../ai-interaction/proposal-email-parser";
import { RfpProposalBuilder } from "../zod-schema/RfpProporsal";

const router = Router();

router.post("/submit", async (req: Request, res: Response) => {
  try {
    const { rfpId, vendorEmail, emailContent } = req.body;

    if (!rfpId || !vendorEmail || !emailContent) {
      return res.status(400).json({
        success: false,
        message: "rfpId, vendorEmail, and emailContent are required",
      });
    }

    const rfpRepo = AppDataSource.getRepository(RFP);
    const vendorRepo = AppDataSource.getRepository(Vendor);
    const proposalRepo = AppDataSource.getRepository(RfpProposal);

    const rfp = await rfpRepo.findOne({ where: { id: rfpId } });
    if (!rfp) {
      return res.status(404).json({
        success: false,
        message: "RFP not found",
      });
    }

    let vendor = await vendorRepo.findOne({ where: { email: vendorEmail } });
    if (!vendor) {
      vendor = vendorRepo.create({ email: vendorEmail });
      await vendorRepo.save(vendor);
      console.log(`Created new vendor: ${vendorEmail}`);
    }

    const { proposalData, isComplete, missingFields } = await parseVendorProposalEmail(emailContent);

    if (!isComplete) {
      return res.status(400).json({
        success: false,
        message: "Incomplete proposal data",
        missingFields,
        extractedData: proposalData,
      });
    }

    const builder = new RfpProposalBuilder(proposalData);
    const completeProposal = builder.build();

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

    console.log(`Saved proposal from vendor ${vendorEmail} for RFP ${rfpId}`);

    res.status(201).json({
      success: true,
      message: "Vendor proposal submitted successfully",
      data: {
        proposalId: proposal.id,
        rfpId: rfp.id,
        vendorEmail: vendor.email,
        budgetAmount: proposal.budgetAmount,
        budgetCurrency: proposal.budgetCurrency,
        itemCount: proposal.items.length,
      },
    });
  } catch (error) {
    console.error("Error submitting vendor proposal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit vendor proposal",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/rfp/:rfpId", async (req: Request, res: Response) => {
  try {
    const { rfpId } = req.params;

    const proposalRepo = AppDataSource.getRepository(RfpProposal);
    const proposals = await proposalRepo.find({
      where: { rfp: { id: rfpId } },
      relations: ["vendor", "rfp"],
      order: { createdAt: "DESC" },
    });

    res.json({
      success: true,
      count: proposals.length,
      data: proposals,
    });
  } catch (error) {
    console.error("Error fetching proposals for RFP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch proposals",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const proposalRepo = AppDataSource.getRepository(RfpProposal);
    const proposal = await proposalRepo.findOne({
      where: { id },
      relations: ["vendor", "rfp"],
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    res.json({
      success: true,
      data: proposal,
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch proposal",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
