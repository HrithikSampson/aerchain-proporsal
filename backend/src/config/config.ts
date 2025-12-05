

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({
	path: '.env',
})

export type DbConfig = {
	type: "postgres";
	host: string;
	port: number;
	username: string;
	password: string;
	database: string;
	synchronize: boolean;
	logging: boolean;
};

if (!process.env.LLM_API_KEY) {
    throw new Error("LLM_API_KEY environment variable is not set");
}

export default {
	PORT: Number(process.env.PORT) || 4000,
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",

	DB: {
		type: "postgres" as const,
		host: process.env.DB_HOST || "127.0.0.1",
		port: Number(process.env.DB_PORT) || 5442,
		username: process.env.DB_USER || "postgres",
		password: process.env.DB_PASS || "postgres",
		database: process.env.DB_NAME || "rfp_db",
		synchronize: process.env.TYPEORM_SYNC ? process.env.TYPEORM_SYNC === "true" : true,
		logging: process.env.TYPEORM_LOGGING ? process.env.TYPEORM_LOGGING === "true" : false,
	} as DbConfig,

	// Default LLM model for all clients. Can be overridden with the LLM_MODEL env var.
	LLM_MODEL: process.env.LLM_MODEL || "claude-haiku-4.5",

	API_KEY: process.env.LLM_API_KEY,
};
