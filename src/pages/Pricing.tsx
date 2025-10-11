import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";

const Pricing = () => {
  const { user } = useAuth();

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for getting started with flipbooks",
      features: [
        "Up to 3 flipbooks",
        "Basic customization",
        "Public sharing",
        "Mobile responsive",
        "Standard support"
      ],
      cta: "Get Started Free",
      popular: false,
      limitations: "Limited to 3 flipbooks"
    },
    {
      name: "Pro",
      price: "$19",
      period: "per month",
      description: "For professionals and small businesses",
      features: [
        "Unlimited flipbooks",
        "Advanced customization",
        "Custom branding",
        "Analytics & insights",
        "Embed codes",
        "Priority support",
        "PDF downloads"
      ],
      cta: "Start Pro Trial",
      popular: true,
      limitations: "7-day free trial"
    },
    {
      name: "Business",
      price: "$49",
      period: "per month",
      description: "For teams and growing businesses",
      features: [
        "Everything in Pro",
        "Team collaboration",
        "White-label options",
        "Advanced analytics",
        "API access",
        "Custom domains",
        "24/7 phone support",
        "Bulk operations"
      ],
      cta: "Contact Sales",
      popular: false,
      limitations: "Custom pricing available"
    }
  ];

  const faqs = [
    {
      question: "Can I change plans anytime?",
      answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any billing differences."
    },
    {
      question: "Is there a free trial?",
      answer: "Yes! Pro plan includes a 7-day free trial with full access to all features. No credit card required to start."
    },
    {
      question: "What file formats are supported?",
      answer: "We support PDF files up to 100MB. The flipbooks work on all modern browsers and mobile devices."
    },
    {
      question: "Can I cancel anytime?",
      answer: "Absolutely. You can cancel your subscription at any time from your dashboard. Your flipbooks will remain accessible until the end of your billing period."
    },
    {
      question: "Do you offer refunds?",
      answer: "We offer a 30-day money-back guarantee for all paid plans. Contact our support team if you're not satisfied."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards (Visa, MasterCard, American Express) and PayPal."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section className="py-20 bg-gradient-to-br from-primary/5 to-primary/10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto">
              <Badge variant="secondary" className="mb-4">
                Simple, Transparent Pricing
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
                Choose the perfect plan
                <br />
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  for your needs
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                Start free, upgrade when you're ready. No hidden fees, no surprises.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan, index) => (
                <Card key={index} className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : 'hover:shadow-lg'} transition-all duration-300`}>
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-4 py-1">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                    <div className="mb-4">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">/{plan.period}</span>
                    </div>
                    <CardDescription className="text-base">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    <ul className="space-y-4">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <Check className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <div className="pt-4">
                      <Link to={user ? "/dashboard" : "/auth?signup=true"}>
                        <Button 
                          className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
                          variant={plan.popular ? 'default' : 'outline'}
                        >
                          {plan.cta}
                        </Button>
                      </Link>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        {plan.limitations}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features Comparison */}
        <section className="py-20 bg-card">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Compare all features
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                See exactly what's included in each plan
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                {/* Feature names */}
                <div className="space-y-4">
                  <div className="h-12 flex items-center font-semibold">Features</div>
                  <div className="space-y-3 text-muted-foreground">
                    <div>Flipbooks</div>
                    <div>Custom Branding</div>
                    <div>Analytics</div>
                    <div>Embed Codes</div>
                    <div>API Access</div>
                    <div>Priority Support</div>
                  </div>
                </div>

                {/* Free plan */}
                <div className="space-y-4">
                  <div className="h-12 flex items-center justify-center font-semibold">Free</div>
                  <div className="space-y-3 text-center">
                    <div>3</div>
                    <div>❌</div>
                    <div>❌</div>
                    <div>❌</div>
                    <div>❌</div>
                    <div>❌</div>
                  </div>
                </div>

                {/* Pro plan */}
                <div className="space-y-4">
                  <div className="h-12 flex items-center justify-center font-semibold text-primary">Pro</div>
                  <div className="space-y-3 text-center">
                    <div>Unlimited</div>
                    <div>✅</div>
                    <div>✅</div>
                    <div>✅</div>
                    <div>❌</div>
                    <div>✅</div>
                  </div>
                </div>

                {/* Business plan */}
                <div className="space-y-4">
                  <div className="h-12 flex items-center justify-center font-semibold">Business</div>
                  <div className="space-y-3 text-center">
                    <div>Unlimited</div>
                    <div>✅</div>
                    <div>✅</div>
                    <div>✅</div>
                    <div>✅</div>
                    <div>✅</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Frequently asked questions
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to know about our pricing
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-8">
              {faqs.map((faq, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-3">{faq.question}</h3>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-12 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
                Ready to get started?
              </h2>
              <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
                Join thousands of users creating engaging flipbooks. Start your free trial today.
              </p>
              <Link to={user ? "/dashboard" : "/auth?signup=true"}>
                <Button size="lg" variant="secondary" className="text-base px-8 h-12">
                  {user ? "Go to Dashboard" : "Start Free Trial"}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-primary-foreground">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-lg font-bold text-foreground">FlipFlow</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 FlipFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
