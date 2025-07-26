'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  FileText, 
  Lock, 
  AlertTriangle,
  Users,
  Database,
  CreditCard,
  Globe,
  Eye,
  MessageCircle,
  CheckCircle,
  Info,
  Calendar,
  Mail,
  UserCheck,
  Server,
  Key
} from 'lucide-react'

export default function PrivacyPolicyPage() {
  const informationCategories = [
    {
      category: 'Account Information',
      examples: 'Name, email address, password',
      source: 'Directly from you',
      purpose: 'Account creation, authentication'
    },
    {
      category: 'Contact Information',
      examples: 'Shipping address, phone number',
      source: 'Directly from you',
      purpose: 'Order fulfillment, delivery'
    },
    {
      category: 'Order Information',
      examples: 'Product selections, order history, preferences',
      source: 'Directly from you',
      purpose: 'Order processing, customer service'
    },
    {
      category: 'Payment Information',
      examples: 'Bank transfer details, payment confirmations',
      source: 'Directly from you',
      purpose: 'Manual payment verification'
    },
    {
      category: 'Technical Information',
      examples: 'IP address, browser type, device information',
      source: 'Automatically collected',
      purpose: 'Site functionality, security'
    },
    {
      category: 'Communication Data',
      examples: 'Support messages, feedback, reviews',
      source: 'Directly from you',
      purpose: 'Customer support, service improvement'
    }
  ]

  const sections = [
    {
      id: 'scope-applicability',
      title: '1. Scope and Applicability',
      icon: Globe,
      content: [
        'This Privacy Policy applies to personal data we process about:',
        '• Visitors to the Site',
        '• Customers who browse products or make purchases',
        '• Users who create accounts or interact with our platform',
        '• Individuals who contact us for customer support',
        '',
        'It does not apply to aggregated or anonymized data that cannot reasonably identify you.'
      ]
    },
    {
      id: 'definitions',
      title: '2. Definitions',
      icon: Info,
      content: [
        '"Personal data" (or "personal information") means any information that identifies or can reasonably be linked to a natural person, such as name, email address, shipping address, IP address, or order history.',
        '',
        '"Processing" includes collection, storage, use, disclosure, and deletion of personal data, whether automated or manual.'
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Privacy Policy
            </h1>
            <div className="flex items-center justify-center mb-4">
              <Calendar className="h-5 w-5 text-muted-foreground mr-2" />
              <span className="text-lg font-semibold text-muted-foreground">Last updated: July 31st, 2025</span>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Welcome to ForYouPiece ("Company," "we," "us," "our"). We operate the e-commerce platform located at foryoupiece.com 
              (the "Site") and related product sales and customer support services (collectively, the "Services"). 
              Protecting your privacy is integral to our mission.
            </p>
          </div>

          {/* Important Notice */}
          <Card className="mb-12 border-2 border-blue-200 bg-blue-50/50">
            <CardContent className="p-6">
              <div className="flex items-start space-x-3">
                <Shield className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-blue-800 mb-2">Privacy Protection Commitment</h3>
                  <p className="text-blue-700 text-sm leading-relaxed">
                    This Privacy Policy explains how we collect, use, disclose, secure, and retain your personal data, 
                    as well as the choices and rights you have regarding that information. By using our website and services, 
                    you acknowledge that you have read and understood this Privacy Policy.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table of Contents */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Table of Contents</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <a href="#scope-applicability" className="block text-sm text-primary hover:underline">1. Scope and Applicability</a>
                  <a href="#definitions" className="block text-sm text-primary hover:underline">2. Definitions</a>
                  <a href="#information-collect" className="block text-sm text-primary hover:underline">3. Information We Collect</a>
                  <a href="#how-we-use" className="block text-sm text-primary hover:underline">4. How We Use Personal Data</a>
                  <a href="#payment-processing" className="block text-sm text-primary hover:underline">5. Payment Processing</a>
                  <a href="#cookies-technologies" className="block text-sm text-primary hover:underline">6. Cookies and Similar Technologies</a>
                  <a href="#how-we-share" className="block text-sm text-primary hover:underline">7. How We Share Personal Data</a>
                  <a href="#data-security" className="block text-sm text-primary hover:underline">8. Data Security</a>
                  <a href="#data-retention" className="block text-sm text-primary hover:underline">9. Data Retention</a>
                </div>
                <div className="space-y-2">
                  <a href="#privacy-rights" className="block text-sm text-primary hover:underline">10. Your Privacy Rights</a>
                  <a href="#international-transfers" className="block text-sm text-primary hover:underline">11. International Data Transfers</a>
                  <a href="#third-party-links" className="block text-sm text-primary hover:underline">12. Third-Party Links</a>
                  <a href="#data-breach" className="block text-sm text-primary hover:underline">13. Data Breach Notification</a>
                  <a href="#policy-changes" className="block text-sm text-primary hover:underline">14. Changes to This Policy</a>
                  <a href="#contact-us" className="block text-sm text-primary hover:underline">15. Contact Us</a>
                  <a href="#authentication" className="block text-sm text-primary hover:underline">16. Authentication and Account Security</a>
                  <a href="#inventory-data" className="block text-sm text-primary hover:underline">17. Inventory and Product Data</a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Sections */}
          {sections.map((section) => {
            const IconComponent = section.icon
            return (
              <Card key={section.id} id={section.id} className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <span>{section.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {section.content.map((paragraph, index) => (
                    <p key={index} className={`text-muted-foreground leading-relaxed ${paragraph === '' ? 'mb-4' : 'mb-3'}`}>
                      {paragraph}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )
          })}

          {/* Information We Collect Section */}
          <Card id="information-collect" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <span>3. Information We Collect</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200 rounded-lg">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Category</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Examples</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Source</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {informationCategories.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="border border-gray-200 px-4 py-3 font-semibold">{item.category}</td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">{item.examples}</td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">{item.source}</td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">{item.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Users className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-800 mb-2">Children's Data</h4>
                    <p className="text-orange-700 text-sm">
                      Our Services are designed for users 16 years or older. We do not knowingly collect data from children under 13. 
                      If we discover such collection, we will delete it promptly.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Personal Data */}
          <Card id="how-we-use" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
                <span>4. How We Use Personal Data</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">We use your personal information to:</p>
              <ul className="space-y-2">
                {[
                  'Process and fulfill your orders',
                  'Manage your account and provide customer support',
                  'Communicate about your orders, account, and our services',
                  'Verify manual payment transfers and update order status',
                  'Improve our website functionality and user experience',
                  'Detect and prevent fraud or security incidents',
                  'Comply with legal obligations and business requirements'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Payment Processing */}
          <Card id="payment-processing" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <span>5. Payment Processing</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-800 mb-2">Important:</h4>
                    <p className="text-red-700 text-sm">
                      We use a manual payment verification system via bank transfer. We do not process credit cards or store
                      sensitive payment information on our servers.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Payment verification is handled manually by our team, and we only store:
              </p>
              <ul className="space-y-2">
                {[
                  'Bank transfer reference numbers',
                  'Payment confirmation status',
                  'Transaction dates and amounts'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Cookies and Similar Technologies */}
          <Card id="cookies-technologies" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <span>6. Cookies and Similar Technologies</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">We use cookies and similar technologies to:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Remember your login status and preferences',
                  'Maintain your shopping cart contents',
                  'Analyze site performance and usage patterns',
                  'Provide security features and fraud prevention'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                You can control cookie preferences through your browser settings. Some features may not function properly if cookies are disabled.
              </p>
            </CardContent>
          </Card>

          {/* How We Share Personal Data */}
          <Card id="how-we-share" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <span>7. How We Share Personal Data</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">We may share your information with:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Shipping providers for order delivery',
                  'BoxHero inventory system for stock management',
                  'Cloud hosting providers (Supabase, Vercel) for platform operation',
                  'Analytics services (anonymized data only)',
                  'Legal authorities when required by law'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 text-sm font-semibold">
                  We do not sell, rent, or share your personal information for marketing purposes.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card id="data-security" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <span>8. Data Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">We implement security measures including:</p>
              <ul className="space-y-2">
                {[
                  'Encrypted data transmission (HTTPS/TLS)',
                  'Secure database storage with access controls',
                  'Regular security updates and monitoring',
                  'Limited access to personal data on a need-to-know basis',
                  'Secure backup and recovery procedures'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Data Retention */}
          <Card id="data-retention" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <span>9. Data Retention</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">We retain personal data only as long as necessary for:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Providing our services and fulfilling orders',
                  'Complying with legal obligations (typically 7 years for business records)',
                  'Resolving disputes and enforcing agreements'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                After the retention period, data is securely deleted or anonymized.
              </p>
            </CardContent>
          </Card>

          {/* Your Privacy Rights */}
          <Card id="privacy-rights" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <span>10. Your Privacy Rights</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Depending on your location, you may have the right to:
              </p>
              <ul className="space-y-2 mb-4">
                {[
                  'Access your personal data and obtain a copy',
                  'Correct inaccurate or incomplete information',
                  'Delete your personal data (subject to legal requirements)',
                  'Restrict or object to certain processing activities',
                  'Data portability - receive your data in a structured format',
                  'Withdraw consent where processing is based on consent'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                To exercise these rights, contact us at the information provided below.
              </p>
            </CardContent>
          </Card>

          {/* International Data Transfers */}
          <Card id="international-transfers" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <span>11. International Data Transfers</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                Your data may be processed in servers located outside your country. We ensure appropriate safeguards
                are in place to protect your information during international transfers.
              </p>
            </CardContent>
          </Card>

          {/* Third-Party Links */}
          <Card id="third-party-links" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <span>12. Third-Party Links</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                Our website may contain links to third-party websites. We are not responsible for the privacy practices
                of these external sites. We encourage you to review their privacy policies before providing any information.
              </p>
            </CardContent>
          </Card>

          {/* Data Breach Notification */}
          <Card id="data-breach" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                </div>
                <span>13. Data Breach Notification</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                In the event of a data breach that may affect your personal information, we will notify affected users
                and relevant authorities as required by applicable law, typically within 72 hours of discovery.
              </p>
            </CardContent>
          </Card>

          {/* Changes to This Policy */}
          <Card id="policy-changes" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <span>14. Changes to This Policy</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We may update this Privacy Policy periodically. Material changes will be communicated through:
              </p>
              <ul className="space-y-2">
                {[
                  'Email notification to registered users',
                  'Prominent notice on our website',
                  'Updated "Last modified" date at the top of this policy'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Contact Us */}
          <Card id="contact-us" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <span>15. Contact Us</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">
                For questions about this Privacy Policy or to exercise your privacy rights, please contact us:
              </p>
              <div className="space-y-3 mb-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground"><strong>Email:</strong> info@foryoupiece.com</span>
                </div>
                <div className="flex items-center space-x-3">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground"><strong>Customer Support:</strong> Through our website contact form</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground"><strong>Response Time:</strong> We will respond to privacy requests within 30 days</span>
                </div>
              </div>
              <div className="p-4 bg-primary/5 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Need help?</strong> Visit our <a href="/en/contact" className="text-primary hover:underline">Contact Us</a> page for detailed contact information and support channels.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Authentication and Account Security */}
          <Card id="authentication" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <span>16. Authentication and Account Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">We support multiple authentication methods:</p>
              <ul className="space-y-2 mb-4">
                {[
                  'Email/Password with secure password requirements',
                  'Google OAuth for convenient sign-in',
                  'Telegram Login for verified users'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                We recommend using strong, unique passwords and enabling two-factor authentication where available.
              </p>
            </CardContent>
          </Card>

          {/* Inventory and Product Data */}
          <Card id="inventory-data" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <span>17. Inventory and Product Data</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Our platform integrates with BoxHero inventory management system to:
              </p>
              <ul className="space-y-2 mb-4">
                {[
                  'Display accurate product availability',
                  'Sync product information and pricing',
                  'Manage stock levels and product categories'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                This integration helps ensure accurate product information but does not involve sharing your personal data with BoxHero.
              </p>
            </CardContent>
          </Card>

          {/* Footer Notice */}
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Privacy Policy Agreement
              </h3>
              <p className="text-muted-foreground text-sm">
                By using our website and services, you acknowledge that you have read and understood this Privacy Policy
                and agree to the collection and use of your information as described herein.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
