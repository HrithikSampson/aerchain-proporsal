import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { RfpItem } from "./RfpItem";
import { RfpProposal } from "./RfpProporsal";

@Entity({ name: "rfp" })
export class RFP {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column({ type: "text", nullable: false })
  user_input!: string;

  @Column({
      type: "vector",
      length: 1536,
      nullable: true,
  })
  embedding!: number[] | null;

  @Column({ type: "numeric", nullable: false })
  budgetAmount!: string;

  @Column({ type: "text", nullable: true })
  budgetCurrency!: string;

  @Column({ type: "int", nullable: true })
  proporsalFinalisingEndDate!: number | null;

  @Column({ type: "jsonb" })
  extraItems!: {[key: string]: string};

  @CreateDateColumn({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" , nullable: false})
  createdAt!: Date;

  @OneToMany(() => RfpItem, (item) => item.rfp, { cascade: true })
  items!: RfpItem[];

  @OneToMany(() => RfpProposal, (proposal) => proposal.rfp)
  proposals!: RfpProposal[];
}
