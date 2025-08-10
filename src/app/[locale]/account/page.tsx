import { redirect } from 'next/navigation'

export default function AccountRedirect({ params }: { params: { locale: string } }) {
  // Backward-compatible alias: /[locale]/account -> /[locale]/profile
  redirect(`/${params.locale}/profile`)
}

