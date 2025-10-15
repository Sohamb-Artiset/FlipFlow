import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EnhancedErrorBoundaryWrapper } from "@/components/EnhancedErrorBoundary";
import { queryClient } from "@/lib/queryClient";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Product from "./pages/Product";
import Pricing from "./pages/Pricing";
import Resources from "./pages/Resources";
import FlipbookView from "./pages/FlipbookView";
import FlipbookEdit from "./pages/FlipbookEdit";
import NotFound from "./pages/NotFound";

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={
                  <EnhancedErrorBoundaryWrapper context="dashboard" showReportButton={true}>
                    <Dashboard />
                  </EnhancedErrorBoundaryWrapper>
                } />
                <Route path="/product" element={<Product />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/flipbook/:id" element={
                  <EnhancedErrorBoundaryWrapper context="flipbook-viewer" showReportButton={true}>
                    <FlipbookView />
                  </EnhancedErrorBoundaryWrapper>
                } />
                <Route path="/flipbook/:id/edit" element={
                  <EnhancedErrorBoundaryWrapper context="flipbook-editor" showReportButton={true}>
                    <FlipbookEdit />
                  </EnhancedErrorBoundaryWrapper>
                } />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
