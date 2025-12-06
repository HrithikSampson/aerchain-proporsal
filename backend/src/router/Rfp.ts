import { Router, Request, Response } from "express";
import AppDataSource from "../data-source";
import { RFP } from "../entity/RFP";
import { Vendor } from "../entity/Vendor";
import { RfpProposal } from "../entity/RfpProporsal";
import { sendRfpToVendors } from "../email-interaction/resend-sendEmail";
import { generateVendorRecommendation, generateProposalComparison } from "../ai-interaction/vendor-recommendation";
import config from "../config/config";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
    try {
        const rfpRepository = AppDataSource.getRepository(RFP);
        const rfps = await rfpRepository.find({
            relations: ["items", "proposals"],
            order: {
                createdAt: "DESC"
            }
        });

        res.json({
            success: true,
            count: rfps.length,
            data: rfps
        });
    } catch (error) {
        console.error("Error fetching RFPs:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch RFPs",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const rfpRepository = AppDataSource.getRepository(RFP);

        const rfp = await rfpRepository.findOne({
            where: { id },
            relations: ["items", "proposals"]
        });

        if (!rfp) {
            return res.status(404).json({
                success: false,
                message: "RFP not found"
            });
        }

        res.json({
            success: true,
            data: rfp
        });
    } catch (error) {
        console.error("Error fetching RFP:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch RFP",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

router.post("/:id/send", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { vendorIds } = req.body;

        if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "vendorIds array is required"
            });
        }

        const rfpRepository = AppDataSource.getRepository(RFP);
        const vendorRepository = AppDataSource.getRepository(Vendor);

        const rfp = await rfpRepository.findOne({
            where: { id },
            relations: ["items"]
        });

        if (!rfp) {
            return res.status(404).json({
                success: false,
                message: "RFP not found"
            });
        }

        const vendors = await vendorRepository.find({
            where: vendorIds.map(id => ({ id }))
        });

        if (vendors.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No valid vendors found"
            });
        }

        const vendorEmails = vendors.map(v => v.email);
        const frontendUrl = config.FRONTEND_URL || "http://localhost:3000";
        const rfpLink = `${frontendUrl}/rfp/${rfp.id}`;

        await sendRfpToVendors(vendorEmails, {
            rfpId: rfp.id,
            user_input: rfp.user_input,
            budgetAmount: rfp.budgetAmount,
            budgetCurrency: rfp.budgetCurrency,
            proporsalFinalisingEndDate: rfp.proporsalFinalisingEndDate,
            items: rfp.items,
            extraItems: rfp.extraItems
        }, rfpLink);

        res.json({
            success: true,
            message: `RFP sent to ${vendors.length} vendor(s)`,
            data: {
                rfpId: rfp.id,
                vendorCount: vendors.length,
                vendors: vendors.map(v => ({ id: v.id, email: v.email }))
            }
        });
    } catch (error) {
        console.error("Error sending RFP to vendors:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send RFP to vendors",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

router.get("/:id/recommendation", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const rfpRepository = AppDataSource.getRepository(RFP);
        const proposalRepository = AppDataSource.getRepository(RfpProposal);

        const rfp = await rfpRepository.findOne({
            where: { id },
            relations: ["items"]
        });

        if (!rfp) {
            return res.status(404).json({
                success: false,
                message: "RFP not found"
            });
        }

        const proposals = await proposalRepository.find({
            where: { rfp: { id } },
            relations: ["vendor"],
            order: { createdAt: "DESC" }
        });

        if (proposals.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No proposals found for this RFP"
            });
        }

        const proposalsForComparison = proposals.map(p => ({
            vendorEmail: p.vendor.email,
            budgetAmount: p.budgetAmount || "0",
            budgetCurrency: p.budgetCurrency || "USD",
            items: p.items,
            notes: p.notes,
            createdAt: p.createdAt.toISOString()
        }));

        const rfpForComparison = {
            user_input: rfp.user_input,
            budgetAmount: rfp.budgetAmount,
            budgetCurrency: rfp.budgetCurrency,
            items: rfp.items?.map(item => ({
                itemName: item.specs?.name || "Unknown",
                quantity: item.quantity,
                category: item.specs?.category
            }))
        };

        const [recommendation, comparison] = await Promise.all([
            generateVendorRecommendation(rfpForComparison, proposalsForComparison),
            generateProposalComparison(rfpForComparison, proposalsForComparison)
        ]);

        res.json({
            success: true,
            data: {
                recommendation,
                comparison
            }
        });
    } catch (error) {
        console.error("Error generating recommendation:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate recommendation",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

export default router;
