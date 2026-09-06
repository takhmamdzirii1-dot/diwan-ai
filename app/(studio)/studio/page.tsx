import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const START_SCREENS = ['chat', 'image', 'video', 'library'] as const;

export default async function StudioPage() {
  const saved = (await cookies()).get('vantra_studio_start')?.value;
  const destination = START_SCREENS.includes(saved as (typeof START_SCREENS)[number]) ? saved : 'chat';
  redirect(`/studio/${destination}`);
}
