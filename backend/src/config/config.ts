

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
if(!process.env.EMAIL_PASSWORD) {
	throw new Error("EMAIL_PASSWORD environment variable is not set");
}
if(!process.env.RESEND_API_KEY) {
	throw new Error("RESEND_API_KEY environment variable is not set");
}
if(!process.env.EMAIL_ADDRESS) {
	throw new Error("EMAIL_ADDRESS environment variable is not set");
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
		synchronize: false,
		logging: process.env.TYPEORM_LOGGING ? process.env.TYPEORM_LOGGING === "true" : false,
	} as DbConfig,

	LLM_MODEL: "gemini-1.5-pro",
	RESEND_API_KEY: process.env.RESEND_API_KEY,
	API_KEY: process.env.LLM_API_KEY,
	EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
	EMAIL_ADDRESS: process.env.EMAIL_ADDRESS,
};
