import ClientPage from './lab-client';
import { labs } from '@/lib/local/catalog';
export const dynamicParams = false;
export function generateStaticParams() { return labs.map(({ slug }) => ({ slug })); }
export default function Page() { return <ClientPage />; }
