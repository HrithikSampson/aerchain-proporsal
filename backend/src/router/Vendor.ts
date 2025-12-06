import { Router, Request, Response } from "express";
import AppDataSource from "../data-source";
import { Vendor } from "../entity/Vendor";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const vendorRepository = AppDataSource.getRepository(Vendor);

        const existingVendor = await vendorRepository.findOne({
            where: { email }
        });

        if (existingVendor) {
            return res.status(409).json({
                success: false,
                message: "Vendor with this email already exists"
            });
        }

        const vendor = vendorRepository.create({ email });
        await vendorRepository.save(vendor);

        res.status(201).json({
            success: true,
            message: "Vendor created successfully",
            data: vendor
        });
    } catch (error) {
        console.error("Error creating vendor:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create vendor",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

router.get("/", async (_req: Request, res: Response) => {
    try {
        const vendorRepository = AppDataSource.getRepository(Vendor);
        const vendors = await vendorRepository.find({
            relations: ["proposals"],
            order: {
                email: "ASC"
            }
        });

        res.json({
            success: true,
            count: vendors.length,
            data: vendors
        });
    } catch (error) {
        console.error("Error fetching vendors:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch vendors",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const vendorRepository = AppDataSource.getRepository(Vendor);

        const vendor = await vendorRepository.findOne({
            where: { id },
            relations: ["proposals"]
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found"
            });
        }

        res.json({
            success: true,
            data: vendor
        });
    } catch (error) {
        console.error("Error fetching vendor:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch vendor",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

router.put("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const vendorRepository = AppDataSource.getRepository(Vendor);

        const vendor = await vendorRepository.findOne({
            where: { id }
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found"
            });
        }

        const existingVendor = await vendorRepository.findOne({
            where: { email }
        });

        if (existingVendor && existingVendor.id !== id) {
            return res.status(409).json({
                success: false,
                message: "Another vendor with this email already exists"
            });
        }

        vendor.email = email;
        await vendorRepository.save(vendor);

        res.json({
            success: true,
            message: "Vendor updated successfully",
            data: vendor
        });
    } catch (error) {
        console.error("Error updating vendor:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update vendor",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const vendorRepository = AppDataSource.getRepository(Vendor);

        const vendor = await vendorRepository.findOne({
            where: { id },
            relations: ["proposals"]
        });

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: "Vendor not found"
            });
        }

        if (vendor.proposals && vendor.proposals.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Cannot delete vendor with existing proposals"
            });
        }

        await vendorRepository.remove(vendor);

        res.json({
            success: true,
            message: "Vendor deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting vendor:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete vendor",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

export default router;
