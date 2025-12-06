import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { RfpProposal } from "./RfpProporsal";

@Entity({ name: "vendor" })
export class Vendor {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "text", unique: true, nullable: false })
    email!: string;

    @OneToMany(() => RfpProposal, (proposal) => proposal.vendor)
    proposals!: RfpProposal[];
}