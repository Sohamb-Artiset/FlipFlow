import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation } from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";

const Resources = () => {
  const { user } = useAuth();

  const helpCategories = [
    {
      title: "Getting Started",
      description: "Learn the basics of creating your first flipbook",
      icon: "🚀",
      articles: [
        "How to upload your first PDF",
        "Basic flipbook customization",
        "Understanding the dashboard",
        "Sharing your flipbook"
      ]
    },
    {
      title: "Customization",
      description: "Make your flipbooks unique with advanced features",
      icon: "🎨",
      articles: [
        "Adding your logo and branding",
        "Customizing colors and themes",
        "Embedding videos and audio",
        "Setting up custom backgrounds"
      ]
    },
    {
      title: "Sharing & Distribution",
      description: "Learn how to share and embed your flipbooks",
      icon: "📤",
      articles: [
        "Generating public links",
        "Creating embed codes",
        "Offline downloads",
        "Social media sharing tips"
      ]
    },
    {
      title: "Analytics & Insights",
      description: "Track performance and understand your audience",
      icon: "📊",
      articles: [
        "Understanding view metrics",
        "Engagement analytics",
        "Exporting reports",
        "Optimizing for better performance"
      ]
    }
  ];

  const tutorials = [
    {
      title: "Creating Your First Flipbook",
      duration: "5 min read",
      level: "Beginner",
      description: "Step-by-step guide to convert your PDF into an interactive flipbook"
    },
    {
      title: "Advanced Customization Guide",
      duration: "12 min read",
      level: "Intermediate",
      description: "Learn advanced techniques for branding and customizing your flipbooks"
    },
    {
      title: "Analytics Deep Dive",
      duration: "8 min read",
      level: "Intermediate",
      description: "Understanding and leveraging flipbook analytics for better engagement"
    },
    {
      title: "Best Practices for Digital Publishing",
      duration: "15 min read",
      level: "Advanced",
      description: "Industry tips and best practices for creating engaging digital content"
    }
  ];

  const supportOptions = [
    {
      title: "Help Center",
      description: "Browse our comprehensive knowledge base",
      icon: "📚",
      action: "Browse Articles",
      available: true
    },
    {
      title: "Video Tutorials",
      description: "Watch step-by-step video guides",
      icon: "🎥",
      action: "Watch Videos",
      available: true
    },
    {
      title: "Community Forum",
      description: "Connect with other users and get help",
      icon: "👥",
      action: "Join Community",
      available: false
    },
    {
      title: "Live Chat Support",
      description: "Get instant help from our support team",
      icon: "💬",
      action: "Start Chat",
      available: true
    },
    {
      title: "Email Support",
      description: "Send us a message and we'll get back to you",
      icon: "📧",
      action: "Send Email",
      available: true
    },
    {
      title: "Phone Support",
      description: "Speak directly with our support team",
      icon: "📞",
      action: "Call Us",
      available: false
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
                Resources & Support
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
                Everything you need to
                <br />
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  succeed with FlipFlow
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                Get help, learn best practices, and connect with our community of flipbook creators.
              </p>
            </div>
          </div>
        </section>

        {/* Help Categories */}
        <section className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Help by category
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Find answers organized by what you're trying to accomplish
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {helpCategories.map((category, index) => (
                <Card key={index} className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="text-3xl mb-4">{category.icon}</div>
                    <CardTitle className="text-xl mb-2">{category.title}</CardTitle>
                    <CardDescription>
                      {category.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {category.articles.map((article, articleIndex) => (
                        <li key={articleIndex} className="flex items-center text-sm text-muted-foreground">
                          <svg className="w-4 h-4 text-primary mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {article}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Tutorials */}
        <section className="py-20 bg-card">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Featured tutorials
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Step-by-step guides to help you master FlipFlow
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {tutorials.map((tutorial, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-lg">{tutorial.title}</CardTitle>
                      <Badge variant={tutorial.level === 'Beginner' ? 'default' : tutorial.level === 'Intermediate' ? 'secondary' : 'outline'}>
                        {tutorial.level}
                      </Badge>
                    </div>
                    <CardDescription>{tutorial.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{tutorial.duration}</span>
                      <Button variant="outline" size="sm">
                        Read Tutorial
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Support Options */}
        <section className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Get support
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Multiple ways to get help when you need it
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {supportOptions.map((option, index) => (
                <Card key={index} className={`hover:shadow-lg transition-shadow ${!option.available ? 'opacity-60' : ''}`}>
                  <CardContent className="pt-6 text-center">
                    <div className="text-4xl mb-4">{option.icon}</div>
                    <h3 className="text-lg font-semibold mb-2">{option.title}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{option.description}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={!option.available}
                      className="w-full"
                    >
                      {option.available ? option.action : 'Coming Soon'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="py-20 bg-card">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Quick links
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Popular resources and frequently accessed pages
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <Card className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">User Guide</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Complete guide covering all FlipFlow features
                  </p>
                  <Button variant="outline" size="sm">
                    View Guide
                  </Button>
                </CardContent>
              </Card>

              <Card className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">API Documentation</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Integrate FlipFlow with your applications
                  </p>
                  <Button variant="outline" size="sm">
                    View Docs
                  </Button>
                </CardContent>
              </Card>

              <Card className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Status Page</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Check system status and uptime
                  </p>
                  <Button variant="outline" size="sm">
                    Check Status
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-12 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
                Still need help?
              </h2>
              <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
                Can't find what you're looking for? Our support team is here to help.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" variant="secondary" className="text-base px-8 h-12">
                  Contact Support
                </Button>
                <Link to={user ? "/dashboard" : "/auth?signup=true"}>
                  <Button size="lg" variant="outline" className="text-base px-8 h-12 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                    {user ? "Go to Dashboard" : "Get Started Free"}
                  </Button>
                </Link>
              </div>
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

export default Resources;
