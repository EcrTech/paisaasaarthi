interface StepProgressBarProps {
  currentStep: number;
  totalSteps?: number;
}

const STEP_LABELS = ["Details", "PAN", "Aadhaar", "Video"];

export function StepProgressBar({ currentStep, totalSteps = 4 }: StepProgressBarProps) {
  return (
    <div className="py-4 px-4">
      <div className="max-w-xs mx-auto">
        {/* Step circles with connecting lines */}
        <div className="flex items-center justify-between relative">
          {/* Background line */}
          <div className="absolute top-3 left-4 right-4 h-0.5 bg-border" />
          
          {/* Progress line */}
          <div 
            className="absolute top-3 left-4 h-0.5 bg-primary transition-all duration-300"
            style={{ 
              width: `calc(${((Math.min(currentStep, totalSteps) - 1) / (totalSteps - 1)) * 100}% - 32px)` 
            }}
          />

          {STEP_LABELS.slice(0, totalSteps).map((label, index) => {
            const stepNum = index + 1;
            const isCompleted = currentStep > stepNum;
            const isCurrent = currentStep === stepNum;

            return (
              <div key={stepNum} className="flex flex-col items-center z-10">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2"
                      : "bg-card border-2 border-border text-muted-foreground"
                  }`}
                >
                  {isCompleted ? "✓" : stepNum}
                </div>
                <span 
                  className={`mt-1.5 text-[10px] font-medium ${
                    isCurrent 
                      ? "text-primary" 
                      : isCompleted 
                      ? "text-primary" 
                      : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
