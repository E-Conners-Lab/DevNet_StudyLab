"use client";

import { APP_NAME } from "@/lib/product";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function Home() {
 const router = useRouter();
 useEffect(() => { router.replace("/dashboard"); }, [router]);
 return <main><h1>{APP_NAME}</h1><Link href="/dashboard">Open your study dashboard</Link></main>;
}
