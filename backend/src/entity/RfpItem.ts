import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    Index,
} from "typeorm";
import { RFP } from "./RFP";

@Entity({ name: "rfp_item" })
@Index(["rfp"])
export class RfpItem {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "text", nullable: true })
    description!: string | null;

    @Column({ type: "int", nullable: false, default: 1 })
    quantity!: number;

    @Column({ type: "jsonb", default: {}, nullable: false })
    specs!: Record<string, string>;
    
    @ManyToOne(() => RFP, (rfp) => rfp.items, { onDelete: "CASCADE" })
    rfp!: RFP;
}