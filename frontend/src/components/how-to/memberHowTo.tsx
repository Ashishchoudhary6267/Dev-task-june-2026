
"use client";

import { useState } from "react";
import Image from "next/image";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
    title: string;
    description: string;
    image: string;
}

const steps: Step[] = [
    {
        title: "Welcome to Your Workspace",
        description:
            "Manage your tasks, approvals, reviews, and workflow from one centralized dashboard.",
        image: "/onboarding/performance.png",
    },
    {
        title: "Track Detailed Tasks",
        description:
            "View assigned tasks with due dates, turnaround time, progress, and status indicators.",
        image: "/onboarding/tasks.png",
    },
    {
        title: "Submit Completed Tasks",
        description:
            "Use the submit button to send completed work for approval instantly.",
        image: "/onboarding/submit.png",
    },
    {
        title: "Approval Queue & Reviews",
        description:
            "Approvers can review, approve, or reject tasks from the approval queue.",
        image: "/onboarding/approval.png",
    },
    {
        title: "Ask AI For Help",
        description:
            "Need assistance? Use AI support anytime for workflow guidance and task help.",
        image: "/onboarding/askAI.png",
    },
];

interface MemberHowToModalProps {
    userName?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MemberHowToModal({ userName, open, onOpenChange }: MemberHowToModalProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onOpenChange(false);
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const step = steps[currentStep];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-6xl p-0 overflow-y-auto sm:overflow-hidden rounded-2xl sm:rounded-3xl border-0 bg-background shadow-2xl max-h-[95vh] sm:min-h-[80vh] relative">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onOpenChange(false)}
                    className="absolute right-4 top-4 z-50 rounded-full bg-white/50 backdrop-blur-sm hover:bg-white/80 transition-all border border-gray-100 shadow-sm"
                >
                    <X className="h-5 w-5 text-gray-500" />
                </Button>
                <div className="flex flex-col md:grid md:grid-cols-2 min-h-0 md:h-[600px]">
                    {/* Left Content */}
                    <div className="p-6 sm:p-8 md:p-12 flex flex-col justify-between order-2 md:order-1 min-h-0">
                        <div className="mb-8 md:mb-0">
                            <div className="flex items-center gap-3 mb-6">
                                <span className={cn(
                                    "text-[10px] md:text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full",
                                    "text-violet-600 bg-violet-50"
                                )}>
                                    Step {currentStep + 1} of {steps.length}
                                </span>
                                <div className="flex gap-1.5">
                                    {steps.map((_, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "h-1 rounded-full transition-all duration-300",
                                                index === currentStep ? "w-6 bg-violet-600" : "w-1.5 bg-gray-200"
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                            {currentStep === 0 && (
                                <p className="text-violet-600 font-bold mb-2 text-sm md:text-base animate-in slide-in-from-left duration-500">
                                    Hi, {userName || "there"}! Welcome to the platform.
                                </p>
                            )}

                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-4">
                                {currentStep === 0 ? "Here is a breakdown of how it works" : step.title}
                            </h2>

                            <p className="text-gray-600 text-sm sm:text-base md:text-lg leading-relaxed font-medium">
                                {step.description}
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-3 sm:gap-4 mt-6 md:mt-10">
                            <Button
                                variant="outline"
                                onClick={prevStep}
                                disabled={currentStep === 0}
                                className="h-11 sm:h-12 md:h-14 px-4 sm:px-6 md:px-8 rounded-xl sm:rounded-2xl border-2 font-bold hover:bg-gray-50 transition-all font-geist"
                            >
                                <ChevronLeft className="w-4 h-4 md:mr-2" />
                                <span className={cn(currentStep === 0 ? "hidden" : "inline-block sm:inline")}>Back</span>
                            </Button>

                            <Button
                                onClick={nextStep}
                                className="flex-1 h-11 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base md:text-lg shadow-lg shadow-violet-200 hover:shadow-xl hover:-translate-y-0.5 transition-all font-geist"
                            >
                                {currentStep === steps.length - 1 ? "Start Working" : "Next Step"}
                                {currentStep !== steps.length - 1 && (
                                    <ChevronRight className="w-4 h-4 ml-2" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Right Image */}
                    <div className="relative w-full h-[250px] sm:h-[300px] md:h-full bg-gray-50 border-b md:border-b-0 md:border-l border-gray-100 order-1 md:order-2">
                        <Image
                            src={step.image}
                            alt={step.title}
                            fill
                            className="object-contain p-4 sm:p-6 md:p-10"
                            priority
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}