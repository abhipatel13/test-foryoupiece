import { redirect } from 'next/navigation'

export default function SettingsRedirectPage({ params }: { params: { locale: string } }) {
  // Redirect to the Profile page "Settings" area (account/security + address)
  redirect(`/${params.locale}/profile#settings`)
}

