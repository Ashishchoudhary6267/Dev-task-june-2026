'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    ChevronLeft,
    ChevronRight,
    Zap,
    FileText,
    PlayCircle,
    ShieldCheck,
    ListChecks,
    TrendingUp,
    X,
    CheckCircle2,
    BarChart3,
    Clock,
    Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Step {
    title: string;
    description: string;
    color: string;
}

const STEPS: Step[] = [
    {
        title: "The Process Mindset",
        description: "Think of your services like a digital assembly line. Every chaotic task or output can be converted into a repeatable, frictionless process. Everything is convertible.",
        color: "blue",
    },
    {
        title: "1. Define Requirements",
        description: "It starts with absolute clarity. Define exactly what is needed before work begins, eliminating back-and-forth and preventing bottlenecks early.",
        color: "indigo",
    },
    {
        title: "2. The Execution Phase",
        description: "Deep work happens here. With requirements clear, your team executes the task seamlessly without managerial friction or missing context.",
        color: "purple",
    },
    {
        title: "3. Quality Assurance",
        description: "Every output passes through a strict checkpoint. Work cannot move forward without passing the automated or manual audit gates.",
        color: "emerald",
    },
    {
        title: "4. The Final Checklist",
        description: "Ensure nothing is missed. A mandatory checklist guarantees 100% compliance before handoffs, ensuring consistent premium quality.",
        color: "amber",
    },
    {
        title: "Total Optimization",
        description: "By structuring your work this way, chaos disappears. Turnaround times drop, quality skyrockets, and your business scales effortlessly.",
        color: "emerald",
    }
];

// Reusable animated node for the right panel
const ProcessNode = ({ active, completed, icon: Icon, title, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay }}
        className={cn(
            "flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all duration-500",
            active ? "bg-primary/10 border-primary shadow-[0_0_30px_rgba(var(--primary),0.2)] scale-105" :
                completed ? "bg-emerald-500/10 border-emerald-500/30 opacity-70" :
                    "bg-gray-50 border-gray-100 opacity-50"
        )}
    >
        <div className={cn(
            "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors shrink-0",
            active ? "bg-primary text-primary-foreground" :
                completed ? "bg-emerald-500 text-white" :
                    "bg-gray-200 text-gray-400"
        )}>
            {completed ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" /> : <Icon className="w-4 h-4 md:w-5 md:h-5" />}
        </div>
        <span className={cn(
            "font-bold text-sm md:text-base",
            active ? "text-primary" : completed ? "text-emerald-700" : "text-gray-500"
        )}>
            {title}
        </span>
    </motion.div>
);

interface HowToModalProps {
    userName?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function HowToModal({ userName, open, onOpenChange }: HowToModalProps) {
    const [currentStep, setCurrentStep] = useState(0);

    const next = () => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1));
    const back = () => setCurrentStep((s) => Math.max(0, s - 1));

    const step = STEPS[currentStep];

    const renderRightPanel = () => {
        if (currentStep === 5) {
            // Step 6: 10/10 Optimization Screen
            return (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[#0a0a0f] text-white rounded-3xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.2),transparent_70%)]" />

                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative z-10 flex flex-col items-center text-center"
                    >
                        <div className="w-32 h-32 rounded-full bg-emerald-500/20 flex items-center justify-center border-4 border-emerald-500/50 mb-8 shadow-[0_0_50px_rgba(16,185,129,0.4)]">
                            <TrendingUp className="w-16 h-16 text-emerald-400" />
                        </div>
                        <h3 className="text-4xl font-black text-emerald-400 tracking-tight mb-2">10/10</h3>
                        <p className="text-xl font-bold text-white mb-8">Parameters Optimized</p>

                        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                            {[
                                { icon: Clock, label: "Turnaround Time", value: "-40%" },
                                { icon: ShieldCheck, label: "Quality Rate", value: "99.9%" },
                                { icon: Users, label: "Team Friction", value: "Zero" },
                                { icon: BarChart3, label: "Process Visibility", value: "100%" },
                            ].map((stat, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + (i * 0.1) }}
                                    className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center"
                                >
                                    <stat.icon className="w-6 h-6 text-emerald-400 mb-2" />
                                    <span className="text-xs text-gray-400">{stat.label}</span>
                                    <span className="font-bold text-white">{stat.value}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            );
        }

        // Steps 1-5: Process Builder Visualizer
        return (
            <div className="w-full h-full flex flex-col justify-center px-6 md:px-12 relative bg-white">
                <div className="absolute left-8 md:left-13 top-1/4 bottom-1/4 w-0.5 bg-gray-100 z-0 hidden md:block" />

                <div className="relative z-10 flex flex-col gap-4 md:gap-6 w-full max-w-sm mx-auto">
                    <ProcessNode
                        active={currentStep === 1}
                        completed={currentStep > 1}
                        icon={FileText}
                        title="1. Define Requirements"
                        delay={0.1}
                    />
                    <ProcessNode
                        active={currentStep === 2}
                        completed={currentStep > 2}
                        icon={PlayCircle}
                        title="2. Execution Phase"
                        delay={0.2}
                    />
                    <ProcessNode
                        active={currentStep === 3}
                        completed={currentStep > 3}
                        icon={ShieldCheck}
                        title="3. Quality Assurance"
                        delay={0.3}
                    />
                    <ProcessNode
                        active={currentStep === 4}
                        completed={currentStep > 4}
                        icon={ListChecks}
                        title="4. The Checklist"
                        delay={0.4}
                    />
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-6xl p-0 overflow-y-auto sm:overflow-hidden border-none shadow-2xl bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl max-h-[95vh] sm:h-auto overflow-x-auto">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onOpenChange(false)}
                    className="absolute right-4 top-4 z-50 rounded-full bg-white/50 backdrop-blur-sm hover:bg-white/80 transition-all border border-gray-100 shadow-sm"
                >
                    <X className="h-5 w-5 text-gray-500" />
                </Button>
                <div className="flex flex-col md:grid md:grid-cols-2 min-h-0 md:h-[650px]">
                    {/* Left Content Section */}
                    <div className="p-6 sm:p-8 md:p-12 flex flex-col justify-between order-2 md:order-1 relative min-h-0">
                        {/* Header Accent */}
                        <div className={cn(
                            "absolute top-0 left-0 h-1.5 w-full transition-colors duration-500",
                            step.color === 'blue' ? "bg-blue-500" :
                                step.color === 'indigo' ? "bg-indigo-500" :
                                    step.color === 'purple' ? "bg-purple-500" :
                                        step.color === 'emerald' ? "bg-emerald-500" : "bg-amber-500"
                        )} />

                        <div className="mb-8 md:mb-0">
                            <div className="flex items-center justify-between mb-6 md:mb-8">
                                <span className={cn(
                                    "text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg",
                                    step.color === 'blue' ? "text-blue-600 bg-blue-50" :
                                        step.color === 'indigo' ? "text-indigo-600 bg-indigo-50" :
                                            step.color === 'purple' ? "text-purple-600 bg-purple-50" :
                                                step.color === 'emerald' ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"
                                )}>
                                    Step {currentStep + 1} of {STEPS.length}
                                </span>

                                {/* Progress Dots */}
                                <div className="flex items-center gap-2">
                                    {STEPS.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "h-1.5 rounded-full transition-all duration-300",
                                                idx === currentStep ? "w-6 sm:w-8 bg-primary" : "w-1.5 bg-muted-foreground/20"
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight mb-4 md:mb-6">
                                        {step.title}
                                    </h2>

                                    <p className="text-gray-600 text-base sm:text-lg md:text-xl leading-relaxed font-medium">
                                        {step.description}
                                    </p>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 mt-6 md:mt-12 pt-6 md:pt-8 border-t border-gray-100 uppercase tracking-tight">
                            <Button
                                variant="outline"
                                onClick={back}
                                disabled={currentStep === 0}
                                className="h-11 sm:h-12 md:h-14 px-4 sm:px-6 md:px-8 rounded-xl sm:rounded-2xl border-2 font-bold hover:bg-gray-50 transition-all font-geist"
                            >
                                <ChevronLeft className="h-5 w-5 md:mr-1" />
                                <span className="hidden sm:inline">Back</span>
                            </Button>

                            {currentStep === STEPS.length - 1 ? (
                                <Button
                                    onClick={() => onOpenChange(false)}
                                    className="flex-1 h-11 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base md:text-lg shadow-xl shadow-emerald-500/20 bg-emerald-500 hover:bg-emerald-600 hover:shadow-2xl hover:-translate-y-0.5 transition-all text-white"
                                >
                                    Start Optimizing
                                </Button>
                            ) : (
                                <Button
                                    onClick={next}
                                    className="flex-1 h-11 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base md:text-lg shadow-xl shadow-primary/20 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                                >
                                    Next Step
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Right Interactive Section */}
                    <div className="relative w-full h-[300px] sm:h-[400px] md:h-full bg-gray-50/50 border-b md:border-b-0 md:border-l border-gray-100 overflow-hidden order-1 md:order-2 p-4">
                        {renderRightPanel()}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

