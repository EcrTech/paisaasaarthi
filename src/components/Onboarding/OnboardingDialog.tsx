import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "@/hooks/useNotification";
import { useAuth } from "@/contexts/AuthContext";
interface OnboardingStep {
  title: string;
  description: string;
  action?: {
    label: string;
    path: string;
  };
}

const roleSteps: Record<string, OnboardingStep[]> = {
  super_admin: [
    {
      title: "Welcome, Super Admin!",
      description: "You have full access to all system features. Let's get you started with the key areas you'll manage.",
    },
    {
      title: "Manage Your Organization",
      description: "Set up your organization profile, upload your logo, and configure company settings.",
      action: { label: "Go to Settings", path: "/settings" },
    },
    {
      title: "Create User Roles & Permissions",
      description: "Define designations, set up reporting hierarchy, and configure approval workflows.",
      action: { label: "Manage Designations", path: "/designations" },
    },
    {
      title: "Build Your Teams",
      description: "Organize your users into teams, assign managers, and structure your organization.",
      action: { label: "Manage Teams", path: "/teams" },
    },
    {
      title: "Configure Custom Fields",
      description: "Customize your contact fields to match your business needs and data requirements.",
      action: { label: "Custom Fields", path: "/custom-fields" },
    },
  ],
  admin: [
    {
      title: "Welcome, Admin!",
      description: "You have administrative access to manage users, teams, and key system configurations.",
    },
    {
      title: "Invite Your Team",
      description: "Start by adding users to your organization and assigning them to appropriate roles.",
      action: { label: "Manage Users", path: "/users" },
    },
    {
      title: "Configure Pipeline Stages",
      description: "Set up your sales pipeline stages to track deals from lead to close.",
      action: { label: "Pipeline Stages", path: "/pipeline-stages" },
    },
    {
      title: "Set Up Call Dispositions",
      description: "Define call outcomes and dispositions for better activity tracking.",
      action: { label: "Call Dispositions", path: "/call-dispositions" },
    },
    {
      title: "Create Custom Forms",
      description: "Build forms to collect lead information and streamline data capture.",
      action: { label: "Manage Forms", path: "/forms" },
    },
  ],
  sales_manager: [
    {
      title: "Welcome, Sales Manager!",
      description: "You're set up to lead your team, track performance, and drive sales success.",
    },
    {
      title: "Review Your Dashboard",
      description: "Monitor key metrics, team performance, and sales trends at a glance.",
      action: { label: "View Dashboard", path: "/dashboard" },
    },
    {
      title: "Manage Your Team",
      description: "Oversee team members, assign leads, and ensure balanced workload distribution.",
      action: { label: "View Teams", path: "/teams" },
    },
    {
      title: "Track Your Pipeline",
      description: "Monitor deals across stages, identify bottlenecks, and forecast accurately.",
      action: { label: "Pipeline Board", path: "/pipeline-board" },
    },
    {
      title: "Analyze Reports",
      description: "Access sales reports, conversion metrics, and team performance analytics.",
      action: { label: "View Reports", path: "/reports" },
    },
  ],
  support_manager: [
    {
      title: "Welcome, Support Manager!",
      description: "You're ready to lead your support team and ensure customer satisfaction.",
    },
    {
      title: "Review Your Dashboard",
      description: "Track support metrics, response times, and customer satisfaction scores.",
      action: { label: "View Dashboard", path: "/dashboard" },
    },
    {
      title: "Manage Your Team",
      description: "Oversee support agents, manage assignments, and balance ticket loads.",
      action: { label: "View Teams", path: "/teams" },
    },
    {
      title: "Monitor Call Activities",
      description: "Review call logs, dispositions, and ensure quality customer interactions.",
      action: { label: "Call Logs", path: "/call-logs" },
    },
    {
      title: "Access Customer Contacts",
      description: "View and manage customer information, history, and support tickets.",
      action: { label: "View Contacts", path: "/contacts" },
    },
  ],
  sales_agent: [
    {
      title: "Welcome, Sales Agent!",
      description: "You're all set to connect with leads, close deals, and hit your targets.",
    },
    {
      title: "Explore Your Dashboard",
      description: "View your personal metrics and performance at a glance.",
      action: { label: "View Dashboard", path: "/dashboard" },
    },
    {
      title: "Start with Contacts",
      description: "Access your assigned leads and contacts. Add notes, schedule follow-ups, and track interactions.",
      action: { label: "View Contacts", path: "/contacts" },
    },
    {
      title: "Work Your Pipeline",
      description: "Move deals through stages, update probabilities, and focus on high-value opportunities.",
      action: { label: "Pipeline Board", path: "/pipeline-board" },
    },
    {
      title: "Log Your Activities",
      description: "Record calls, emails, and meetings to maintain accurate activity history.",
      action: { label: "Make Calls", path: "/calling-dashboard" },
    },
  ],
  support_agent: [
    {
      title: "Welcome, Support Agent!",
      description: "You're ready to provide excellent customer support and build lasting relationships.",
    },
    {
      title: "Check Your Dashboard",
      description: "See your assigned tickets and daily activity summary.",
      action: { label: "View Dashboard", path: "/dashboard" },
    },
    {
      title: "Access Customer Contacts",
      description: "View customer information, interaction history, and support needs.",
      action: { label: "View Contacts", path: "/contacts" },
    },
    {
      title: "Handle Calls Efficiently",
      description: "Use the calling dashboard to manage customer calls and log outcomes.",
      action: { label: "Calling Dashboard", path: "/calling-dashboard" },
    },
    {
      title: "Track Your Activities",
      description: "Log all customer interactions to maintain comprehensive support records.",
      action: { label: "View Call Logs", path: "/call-logs" },
    },
  ],
};

interface OnboardingDialogProps {
  open: boolean;
  userRole: string;
  onComplete: () => void;
}

export function OnboardingDialog({ open, userRole, onComplete }: OnboardingDialogProps) {
  const notify = useNotification();
  const { refreshAuth } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  
  const steps = roleSteps[userRole] || roleSteps.sales_agent;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ onboarding_completed: true })
          .eq("id", user.id);

        if (error) throw error;

        // Refresh AuthContext to update the profile state
        await refreshAuth();

        notify.success("Welcome aboard! 🎉", "You're all set to start using the platform.");
        
        onComplete();
      }
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      notify.error("Error", error);
    } finally {
      setCompleting(false);
    }
  };

  const handleActionClick = () => {
    handleComplete();
  };

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle className="text-2xl">
              {currentStep === 0 ? "Welcome to Paisaa Saarthi LOS!" : currentStepData.title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {currentStepData.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="flex justify-between">
            {steps.map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-1">
                {index < currentStep ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : index === currentStep ? (
                  <Circle className="h-6 w-6 text-primary fill-primary" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>

          {/* Action Button for steps with actions */}
          {currentStepData.action && (
            <Button
              onClick={handleActionClick}
              className="w-full"
              size="lg"
              variant="outline"
            >
              {currentStepData.action.label}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {isLastStep ? (
            <Button onClick={handleComplete} disabled={completing}>
              {completing ? "Finishing..." : "Get Started"}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
