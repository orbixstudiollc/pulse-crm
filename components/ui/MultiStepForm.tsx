"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { CheckIcon } from "./Icons";

interface Step {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  validate?: () => boolean | Promise<boolean>;
}

interface MultiStepFormContextValue {
  currentStep: number;
  steps: Step[];
  goToStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  formData: Record<string, unknown>;
  setFormData: (data: Record<string, unknown>) => void;
}

const MultiStepFormContext = createContext<
  MultiStepFormContextValue | undefined
>(undefined);

export function useMultiStepForm() {
  const context = useContext(MultiStepFormContext);
  if (!context) {
    throw new Error("useMultiStepForm must be used within MultiStepForm");
  }
  return context;
}

interface MultiStepFormProps {
  steps: Step[];
  onComplete: (data: Record<string, unknown>) => void | Promise<void>;
  children: ReactNode;
  initialData?: Record<string, unknown>;
  showProgress?: boolean;
  className?: string;
}

export function MultiStepForm({
  steps,
  onComplete,
  children,
  initialData = {},
  showProgress = true,
  className,
}: MultiStepFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const goToStep = (step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  };

  const nextStep = async () => {
    const step = steps[currentStep];
    if (step.validate) {
      const isValid = await step.validate();
      if (!isValid) return;
    }

    if (isLastStep) {
      await onComplete(formData);
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const previousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const updateFormData = (data: Record<string, unknown>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const contextValue: MultiStepFormContextValue = {
    currentStep,
    steps,
    goToStep,
    nextStep,
    previousStep,
    isFirstStep,
    isLastStep,
    formData,
    setFormData: updateFormData,
  };

  const progressPercentage = ((currentStep + 1) / steps.length) * 100;

  return (
    <MultiStepFormContext.Provider value={contextValue}>
      <div className={cn("space-y-6", className)}>
        {/* Progress Bar */}
        {showProgress && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <button
                        type="button"
                        onClick={() => goToStep(index)}
                        disabled={index > currentStep}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-colors relative z-10",
                          isCompleted &&
                            "bg-indigo-600 text-white hover:bg-indigo-700",
                          isCurrent &&
                            "bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-900",
                          !isCompleted &&
                            !isCurrent &&
                            "bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400",
                          index > currentStep &&
                            "cursor-not-allowed opacity-50"
                        )}
                        aria-current={isCurrent ? "step" : undefined}
                        aria-label={`Step ${index + 1}: ${step.title}`}
                      >
                        {isCompleted ? (
                          <CheckIcon className="h-5 w-5" />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </button>
                      <div className="mt-2 text-center">
                        <p
                          className={cn(
                            "text-xs font-medium",
                            isCurrent
                              ? "text-neutral-900 dark:text-neutral-100"
                              : "text-neutral-500 dark:text-neutral-400"
                          )}
                        >
                          {step.title}
                        </p>
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={cn(
                          "h-0.5 flex-1 -mt-10",
                          index < currentStep
                            ? "bg-indigo-600"
                            : "bg-neutral-200 dark:bg-neutral-800"
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Linear Progress Bar */}
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
              <motion.div
                className="h-full bg-indigo-600"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.3 }}
                role="progressbar"
                aria-valuenow={progressPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Form progress"
              />
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MultiStepFormContext.Provider>
  );
}

interface StepNavigationProps {
  onNext?: () => void | Promise<void>;
  onPrevious?: () => void;
  nextLabel?: string;
  previousLabel?: string;
  loading?: boolean;
  className?: string;
}

export function StepNavigation({
  onNext,
  onPrevious,
  nextLabel,
  previousLabel,
  loading = false,
  className,
}: StepNavigationProps) {
  const { nextStep, previousStep, isFirstStep, isLastStep } =
    useMultiStepForm();

  const handleNext = async () => {
    if (onNext) {
      await onNext();
    }
    await nextStep();
  };

  const handlePrevious = () => {
    if (onPrevious) {
      onPrevious();
    }
    previousStep();
  };

  return (
    <div className={cn("flex items-center justify-between pt-6", className)}>
      <Button
        type="button"
        variant="ghost"
        onClick={handlePrevious}
        disabled={isFirstStep || loading}
      >
        {previousLabel || "Previous"}
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={handleNext}
        loading={loading}
      >
        {nextLabel || (isLastStep ? "Complete" : "Next")}
      </Button>
    </div>
  );
}

interface StepContentProps {
  children: ReactNode;
  className?: string;
}

export function StepContent({ children, className }: StepContentProps) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}
