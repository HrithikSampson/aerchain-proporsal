import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from "typeorm";
import { RFP } from "./RFP";
import { Vendor } from "./Vendor";

@Entity("rfp_proposal")
export class RfpProposal {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "numeric", nullable: true })
  budgetAmount!: string | null;

  @Column({ type: "text", nullable: true })
  budgetCurrency!: string | null;

  @Column({ type: "jsonb", default: [] })
  items!: {
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    specs?: Record<string, string>;
  }[];

  @ManyToOne(() => RFP, (rfp) => rfp.proposals, { onDelete: "CASCADE" })
  rfp!: RFP;

  @ManyToOne(() => Vendor, (vendor) => vendor.proposals, { onDelete: "CASCADE" })
  vendor!: Vendor;

  @Column({ type: "jsonb", nullable: true })
  extraItems!: Record<string, string> | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
