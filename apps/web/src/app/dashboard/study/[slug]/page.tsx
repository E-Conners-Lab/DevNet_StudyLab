import ClientPage from './study-client';
import { studyGuides } from '@/lib/local/catalog';
export const dynamicParams = false;
export function generateStaticParams() { return studyGuides.map(({ slug }) => ({ slug })); }
export default function Page() { return <ClientPage />; }
