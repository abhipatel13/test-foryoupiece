'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Scale, 
  Shield, 
  AlertTriangle,
  Users,
  Package,
  CreditCard,
  Globe,
  Lock,
  MessageCircle,
  CheckCircle,
  Info
} from 'lucide-react'

export default function TermsAndConditionsPage() {
  const sections = [
    {
      id: 'introduction',
      title: '1. Introduction',
      icon: FileText,
      subsections: [
        {
          id: 'agreement',
          title: '1.1 Agreement',
          content: 'These Terms and Conditions ("Terms") govern your use of our procurement service ("Service"). By placing an order or otherwise using the Service, you agree to abide by these Terms. If you do not agree, you must refrain from using our Service.'
        },
        {
          id: 'service-providers',
          title: '1.2 Service Providers',
          content: 'These Terms constitute a binding agreement between you (the "Customer") and the individuals operating this Service (collectively referred to as "we," "our," or "us"). We are not a formal company, nor are we a registered corporate entity. Instead, we are individuals offering a product procurement service on a request basis.'
        },
        {
          id: 'legal-compliance',
          title: '1.3 Legal Compliance',
          content: 'We operate under the jurisdiction of the Kingdom of Cambodia (where applicable). Any use of this Service must comply with local, state, national, and international regulations that may apply to you.'
        }
      ]
    },
    {
      id: 'service-operation',
      title: '2. Service-Based Operation',
      icon: Package,
      subsections: [
        {
          id: 'nature-service',
          title: '2.1 Nature of the Service',
          content: [
            'We facilitate the procurement of products on behalf of customers.',
            'We do not hold ourselves out as an authorized retailer, official distributor, or established business reseller.',
            'We are not affiliated with original manufacturers or brand owners beyond purchasing products from legitimate retail channels.'
          ]
        },
        {
          id: 'scope-service',
          title: '2.2 Scope of Service',
          content: [
            'Our role is limited to acting as a procurement service provider and does not extend to manufacturing, distributing, or reselling products in a business capacity.',
            'We purchase items at retail prices based on individual customer requests.'
          ]
        },
        {
          id: 'no-endorsements',
          title: '2.3 No Official Endorsements',
          content: 'We do not claim any endorsement, partnership, or sponsorship from the original product manufacturers or brands. Any mention of brand names is strictly for identification and procurement purposes.'
        }
      ]
    },
    {
      id: 'service-description',
      title: '3. Service Description',
      icon: Info,
      subsections: [
        {
          id: 'procurement-assistance',
          title: '3.1 Procurement Assistance',
          content: 'Upon receiving customer requests, we will attempt to source products from legitimate retail channels in Japan. We do not stock items for general resale; instead, each product is specifically procured to fulfill individual orders.'
        },
        {
          id: 'product-information',
          title: '3.2 Product Information and Imagery',
          content: [
            'All images on our platform are taken by us to help customers visualize the products they may purchase.',
            'Product descriptions, specifications, and related details are provided for reference only.',
            'Images do not imply ownership or endorsement by the brand; they are purely illustrative.'
          ]
        },
        {
          id: 'limitations',
          title: '3.3 Limitations',
          content: 'Because we are private individuals offering a service, the availability of certain products may depend on retail stock and other market factors. We make no guarantee regarding permanent or ongoing availability.'
        }
      ]
    },
    {
      id: 'order-processing',
      title: '4. Order Processing',
      icon: CheckCircle,
      subsections: [
        {
          id: 'placing-order',
          title: '4.1 Placing an Order',
          content: [
            'Each order is fulfilled on an individual, per-customer basis.',
            'Once your order and payment are confirmed, we will begin the procurement process.'
          ]
        },
        {
          id: 'product-sourcing',
          title: '4.2 Product Sourcing',
          content: [
            'We reserve the right to limit quantities based on availability or any constraints set by retail suppliers.',
            'If a product becomes unavailable after your order, we will notify you to explore alternatives or issue a refund, as appropriate.'
          ]
        },
        {
          id: 'delivery-times',
          title: '4.3 Delivery Times',
          content: 'Delivery times can vary depending on a range of factors, including product availability, logistics, and customs procedures. We will do our best to keep you updated on any changes or delays.'
        }
      ]
    },
    {
      id: 'product-authenticity',
      title: '5. Product Authenticity',
      icon: Shield,
      subsections: [
        {
          id: 'guarantee-authenticity',
          title: '5.1 Guarantee of Authenticity',
          content: 'All products are sourced through legitimate retail outlets in Japan. We do not engage in purchasing counterfeit or otherwise unauthorized goods.'
        },
        {
          id: 'condition-products',
          title: '5.2 Condition of Products',
          content: [
            'Products are sold as-is in the same condition they are received from the retailer.',
            'We do not alter, modify, or refurbish any products prior to shipment.'
          ]
        },
        {
          id: 'documentation',
          title: '5.3 Documentation',
          content: 'We maintain records and proof of purchase for each product. Customers may request documentation to confirm the product\'s origin, subject to reasonable limitations.'
        },
        {
          id: 'quality-assurance',
          title: '5.4 Quality Assurance',
          content: 'We check items before shipping to ensure they appear in good condition. Should we discover any defect or damage, we will notify you and seek your direction on how to proceed (e.g., cancel, exchange, or otherwise).'
        }
      ]
    },
    {
      id: 'pricing-payment',
      title: '6. Pricing and Payment',
      icon: CreditCard,
      subsections: [
        {
          id: 'service-fees',
          title: '6.1 Service Fees',
          content: 'Our prices include the product\'s retail cost plus a service fee for our efforts in sourcing and purchasing on your behalf.'
        },
        {
          id: 'final-transactions',
          title: '6.2 Final Transactions',
          content: [
            'All transactions are final once payment is confirmed.',
            'Cancelations or modifications after payment may be subject to suppliers\' policies and applicable fees.'
          ]
        },
        {
          id: 'payment-terms',
          title: '6.3 Payment Terms',
          content: [
            'Full payment must be received before we initiate procurement.',
            'The accepted payment methods and deadlines will be communicated at the time of order.'
          ]
        },
        {
          id: 'additional-fees',
          title: '6.4 Additional Fees',
          content: [
            'Shipping, handling, and any customs or import fees are separate unless explicitly stated otherwise.',
            'Customers are responsible for any duties or taxes incurred in their home country or region.'
          ]
        }
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
                <Scale className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Terms and Conditions
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Please read these terms and conditions carefully before using our procurement service. 
              By placing an order, you agree to be bound by these terms.
            </p>
          </div>

          {/* Important Notice */}
          <Card className="mb-12 border-2 border-orange-200 bg-orange-50/50">
            <CardContent className="p-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-orange-800 mb-2">Important Notice</h3>
                  <p className="text-orange-700 text-sm leading-relaxed">
                    These Terms and Conditions are legally binding. By using our service, you acknowledge that you have read, 
                    understood, and agree to be bound by all terms outlined below. If you do not agree with any part of these terms, 
                    please do not use our service.
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
                  <a href="#introduction" className="block text-sm text-primary hover:underline">1. Introduction</a>
                  <a href="#service-operation" className="block text-sm text-primary hover:underline">2. Service-Based Operation</a>
                  <a href="#service-description" className="block text-sm text-primary hover:underline">3. Service Description</a>
                  <a href="#order-processing" className="block text-sm text-primary hover:underline">4. Order Processing</a>
                  <a href="#product-authenticity" className="block text-sm text-primary hover:underline">5. Product Authenticity</a>
                  <a href="#pricing-payment" className="block text-sm text-primary hover:underline">6. Pricing and Payment</a>
                </div>
                <div className="space-y-2">
                  <a href="#disclaimers" className="block text-sm text-primary hover:underline">7. Disclaimers</a>
                  <a href="#customer-responsibilities" className="block text-sm text-primary hover:underline">8. Customer Responsibilities</a>
                  <a href="#liability-limitations" className="block text-sm text-primary hover:underline">9. Liability Limitations</a>
                  <a href="#privacy-data" className="block text-sm text-primary hover:underline">10. Privacy and Data Protection</a>
                  <a href="#governing-law" className="block text-sm text-primary hover:underline">11. Governing Law and Dispute Resolution</a>
                  <a href="#contact-information" className="block text-sm text-primary hover:underline">12. Contact Information</a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms Sections */}
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
                <CardContent className="space-y-6">
                  {section.subsections.map((subsection) => (
                    <div key={subsection.id} id={subsection.id}>
                      <h4 className="font-semibold text-foreground mb-3">{subsection.title}</h4>
                      {Array.isArray(subsection.content) ? (
                        <ul className="space-y-2">
                          {subsection.content.map((item, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                              <span className="text-muted-foreground leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground leading-relaxed">{subsection.content}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}

          {/* Additional Sections (7-12) */}
          <Card id="disclaimers" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                </div>
                <span>7. Disclaimers</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div id="not-manufacturer">
                <h4 className="font-semibold text-foreground mb-3">7.1 Not a Manufacturer or Distributor</h4>
                <ul className="space-y-2">
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">We are not a registered company, manufacturer, distributor, or official reseller.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">Our role is limited to purchasing items upon request, in a private capacity, from legitimate retail sources.</span>
                  </li>
                </ul>
              </div>
              <div id="manufacturer-warranties">
                <h4 className="font-semibold text-foreground mb-3">7.2 Manufacturer Warranties</h4>
                <p className="text-muted-foreground leading-relaxed">Any warranties offered by the product's manufacturer apply in accordance with the manufacturer's terms. We do not extend any additional warranties.</p>
              </div>
              <div id="no-trademark-claims">
                <h4 className="font-semibold text-foreground mb-3">7.3 No Trademark Claims</h4>
                <p className="text-muted-foreground leading-relaxed">We do not claim rights to any trademarks, brand names, or logos. Use of these marks in product listings or descriptions is purely for identification and procurement purposes.</p>
              </div>
              <div id="third-party-responsibility">
                <h4 className="font-semibold text-foreground mb-3">7.4 Third-Party Responsibility</h4>
                <p className="text-muted-foreground leading-relaxed">Manufacturers or retailers remain responsible for the quality of products and any defects. We do not assume liability for inherent product flaws.</p>
              </div>
            </CardContent>
          </Card>

          <Card id="customer-responsibilities" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <span>8. Customer Responsibilities</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div id="acknowledgment-role">
                <h4 className="font-semibold text-foreground mb-3">8.1 Acknowledgment of Our Role</h4>
                <p className="text-muted-foreground leading-relaxed">By placing an order, you confirm that we act purely as a procurement service provider and not as a company, reseller, or distributor.</p>
              </div>
              <div id="acceptance-terms">
                <h4 className="font-semibold text-foreground mb-3">8.2 Acceptance of Terms</h4>
                <p className="text-muted-foreground leading-relaxed">Placing an order constitutes acceptance of these Terms in their entirety.</p>
              </div>
              <div id="duties-taxes">
                <h4 className="font-semibold text-foreground mb-3">8.3 Duties and Taxes</h4>
                <p className="text-muted-foreground leading-relaxed">You are responsible for understanding and fulfilling any import requirements, including duties, taxes, or additional fees based on your region's regulations.</p>
              </div>
              <div id="resale-obligations">
                <h4 className="font-semibold text-foreground mb-3">8.4 Resale Obligations</h4>
                <p className="text-muted-foreground leading-relaxed">If you intend to resell any products acquired through our Service, you must comply with all local laws, regulations, and licensing requirements.</p>
              </div>
            </CardContent>
          </Card>

          <Card id="liability-limitations" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <span>9. Liability Limitations</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div id="scope-liability">
                <h4 className="font-semibold text-foreground mb-3">9.1 Scope of Liability</h4>
                <p className="text-muted-foreground leading-relaxed mb-3">Our liability is limited to the service of procuring products on your behalf. We are not responsible for:</p>
                <ul className="space-y-2">
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">Manufacturing defects or specifications.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">Damages once products are handed over to the shipping provider.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground leading-relaxed">Delays or issues related to shipping carriers, customs, or other third parties.</span>
                  </li>
                </ul>
              </div>
              <div id="claims">
                <h4 className="font-semibold text-foreground mb-3">9.2 Claims</h4>
                <p className="text-muted-foreground leading-relaxed">If a product arrives damaged or defective, please notify us promptly. We will endeavor to help within reasonable limits, but our liability cannot exceed the actual purchase price (including service fees).</p>
              </div>
              <div id="service-refusal">
                <h4 className="font-semibold text-foreground mb-3">9.3 Service Refusal</h4>
                <p className="text-muted-foreground leading-relaxed">We reserve the right to refuse service, cancel orders, or limit quantities, especially if there is any suspicion of fraudulent activity or misuse of our Service.</p>
              </div>
            </CardContent>
          </Card>

          <Card id="privacy-data" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <span>10. Privacy and Data Protection</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div id="data-collection">
                <h4 className="font-semibold text-foreground mb-3">10.1 Data Collection</h4>
                <p className="text-muted-foreground leading-relaxed">We collect personal information such as your name, address, and contact details strictly to facilitate orders and communicate with you.</p>
              </div>
              <div id="use-personal-information">
                <h4 className="font-semibold text-foreground mb-3">10.2 Use of Personal Information</h4>
                <p className="text-muted-foreground leading-relaxed">Your information is used only for procurement, payment processing, shipping, and customer support. We will not sell or share your personal data with unauthorized third parties.</p>
              </div>
              <div id="legal-compliance-privacy">
                <h4 className="font-semibold text-foreground mb-3">10.3 Legal Compliance</h4>
                <p className="text-muted-foreground leading-relaxed">We strive to comply with applicable data protection laws. You may contact us to request access to, correction, or deletion of your personal data (subject to legal exemptions).</p>
              </div>
              <div id="retention">
                <h4 className="font-semibold text-foreground mb-3">10.4 Retention</h4>
                <p className="text-muted-foreground leading-relaxed">We may retain transactional data for the time necessary to fulfill orders and comply with legal obligations (e.g., record-keeping).</p>
              </div>
            </CardContent>
          </Card>

          <Card id="governing-law" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <span>11. Governing Law and Dispute Resolution</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div id="applicable-law">
                <h4 className="font-semibold text-foreground mb-3">11.1 Applicable Law</h4>
                <p className="text-muted-foreground leading-relaxed">These Terms and any related disputes shall be governed by the laws of the Kingdom of Cambodia, where applicable, without regard to conflict of law principles.</p>
              </div>
              <div id="jurisdiction">
                <h4 className="font-semibold text-foreground mb-3">11.2 Jurisdiction</h4>
                <p className="text-muted-foreground leading-relaxed">Any dispute arising from these Terms shall be subject to the exclusive jurisdiction of the Cambodian courts, unless otherwise agreed upon by both parties.</p>
              </div>
              <div id="changes-terms">
                <h4 className="font-semibold text-foreground mb-3">11.3 Changes to Terms</h4>
                <p className="text-muted-foreground leading-relaxed">We may update or modify these Terms at any time without prior notice. Continued use of our Service after changes are posted constitutes acceptance of the revised Terms.</p>
              </div>
              <div id="severability">
                <h4 className="font-semibold text-foreground mb-3">11.4 Severability</h4>
                <p className="text-muted-foreground leading-relaxed">If any provision of these Terms is deemed invalid or unenforceable, the remaining provisions shall remain in full force and effect.</p>
              </div>
            </CardContent>
          </Card>

          <Card id="contact-information" className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <span>12. Contact Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                For any questions or concerns regarding these Terms or our procurement service, please reach out to us via the contact details provided on our platform.
              </p>
              <div className="mt-4 p-4 bg-primary/5 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Need help?</strong> Visit our <a href="/en/contact" className="text-primary hover:underline">Contact Us</a> page for detailed contact information and support channels.
                </p>
              </div>
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
                Terms Effective Date
              </h3>
              <p className="text-muted-foreground text-sm">
                These Terms and Conditions are effective as of the date of publication and apply to all orders placed through our service.
                By continuing to use our service, you acknowledge that you have read and agree to these terms.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
