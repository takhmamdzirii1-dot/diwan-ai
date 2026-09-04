import { redirect } from 'next/navigation';

export default function RootFallbackPage() {
  redirect('/fr');
}
