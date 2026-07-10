import { PrismaClient } from '@prisma/client';

// Generate standard connection URL dynamically supporting Cloud SQL Unix Socket paths
const getDatabaseUrl = (): string => {
  const user = encodeURIComponent(process.env.SQL_USER || 'ai_studio_app_user');
  const password = encodeURIComponent(process.env.SQL_PASSWORD || '');
  const host = encodeURIComponent(process.env.SQL_HOST || 'localhost');
  const dbName = encodeURIComponent(process.env.SQL_DB_NAME || 'cloud_sql_development_database');
  
  return `postgresql://${user}:${password}@localhost/${dbName}?host=${host}`;
};

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

export default prisma;
