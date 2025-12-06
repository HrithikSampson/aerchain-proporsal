import "reflect-metadata";
import { DataSource } from "typeorm";
import config from "./config/config";
import { RFP } from "./entity/RFP";
import { RfpItem } from "./entity/RfpItem";
import { RfpProposal } from "./entity/RfpProporsal";
import { Vendor } from "./entity/Vendor";

const AppDataSource = new DataSource({
  type: "postgres",
  host: config.DB.host,
  port: config.DB.port,
  username: config.DB.username,
  password: config.DB.password,
  database: config.DB.database,
  synchronize: config.DB.synchronize,
  logging: true,
  entities: [RFP, RfpItem, RfpProposal, Vendor],
  migrations: ["src/migrations/*.ts"],
});

export default AppDataSource;
