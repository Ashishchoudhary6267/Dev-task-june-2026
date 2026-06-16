'use client';

import React, { useState } from 'react';
import { Sparkles, Send, RotateCcw, ArrowLeft, Loader2, AlertCircle, X, History, ChevronDown } from 'lucide-react';
import { Button, Input, Label, Textarea } from '@/components/ui';
import { UISelect } from '@/components/ui';
import { useAICopyStore } from '@/lib/zustand/ai-copy/ai-copy';
import { CopyPromptData } from '@/lib/types/auth';
import CopyDisplayCard from './copy-display-card';

interface AICopyPanelProps {
    taskId: string;
    companyId: string;
    onClose: () => void;
}

const TONE_OPTIONS = [
    { value: 'professional', label: '💼 Professional' },
    { value: 'casual', label: '😊 Casual' },
    { value: 'urgent', label: '⚡ Urgent' },
    { value: 'playful', label: '🎉 Playful' },
    { value: 'luxury', label: '✨ Luxury / Premium' },
    { value: 'friendly', label: '🤝 Friendly' },
    { value: 'informative', label: '📚 Informative' },
    { value: 'bold', label: '🔥 Bold / Edgy' },
];

const COPY_TYPE_OPTIONS = [
    { value: 'email_marketing', label: '📧 Email Marketing' },
    { value: 'social_media', label: '📱 Social Media Post' },
    { value: 'ad_copy', label: '📣 Ad Copy' },
    { value: 'product_description', label: '🏷️ Product Description' },
    // { value: 'landing_page', label: '🌐 Landing Page' },
    { value: 'sms', label: '💬 SMS / Short Message' },
    { value: 'newsletter', label: '📰 Newsletter' },
];

export default function AICopyPanel({ taskId, companyId, onClose }: AICopyPanelProps) {
    const { currentCopy, generating, error, generateCopy, clearCopy, copies, fetchCopiesForTask, fetchingList } = useAICopyStore();

    const [promptData, setPromptData] = useState<CopyPromptData>({
        product_name: '',
        brand_name: '',
        target_audience: '',
        tone: 'professional',
        copy_type: 'email_marketing',
        additional_requirements: '',
        image_links: [],
    });

    const [view, setView] = useState<'prompt' | 'result' | 'history'>(currentCopy ? 'result' : 'prompt');
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

    const updateField = <K extends keyof CopyPromptData>(field: K, value: CopyPromptData[K]) => {
        setPromptData(prev => ({ ...prev, [field]: value }));
    };

    const handleGenerate = async () => {
        if (!promptData.product_name.trim()) return;

        const payload = { ...promptData };
        if (currentCopy) {
            payload.previous_generation = currentCopy.generated_content;
        }

        const result = await generateCopy(taskId, companyId, payload);
        if (result) {
            setView('result');
        }
    };

    const handleRegenerate = async () => {
        const payload = { ...promptData };
        if (currentCopy) {
            payload.previous_generation = currentCopy.generated_content;
        }

        const result = await generateCopy(taskId, companyId, payload);
        if (result) {
            setView('result');
        }
    };

    const handleViewHistory = () => {
        setView('history');
        fetchCopiesForTask(taskId);
    };

    const handleEditPrompt = () => {
        setView('prompt');
    };

    const handleClose = () => {
        clearCopy();
        onClose();
    };

    return (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800/50 bg-linear-to-b from-violet-50/50 to-white dark:from-violet-950/20 dark:to-card overflow-hidden">

            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-violet-100/80 to-blue-100/80 dark:from-violet-900/30 dark:to-blue-900/30 border-b border-violet-200 dark:border-violet-800/40">
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-linear-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-sm">
                        <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground">AI Copywriter</h3>
                        {/* <p className="text-[10px] text-muted-foreground">Powered by Gemini</p> */}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {view !== 'history' ? (
                        <Button variant="outline" size="sm" onClick={handleViewHistory} className="h-7 text-xs px-2 rounded-md border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 gap-1.5 bg-white/50 dark:bg-card/50">
                            <History className="h-3 w-3" />
                            History
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => setView('prompt')} className="h-7 text-xs px-2 rounded-md gap-1.5">
                            <ArrowLeft className="h-3 w-3" />
                            Back
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleClose} className="h-7 w-7 p-0 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30">
                        <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </div>
            </div>

            <div className="p-4 space-y-4">

                {/* Error Banner */}
                {error && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-red-700 dark:text-red-400">Generation Failed</p>
                            <p className="text-xs text-red-600/80 dark:text-red-400/70">{error}</p>
                        </div>
                    </div>
                )}

                {/* ─── PROMPT VIEW ─── */}
                {view === 'prompt' && (
                    <div className="space-y-4">

                        {/* Row 1: Product + Brand */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                                    Product Name <span className="text-red-400">*</span>
                                </Label>
                                <Input
                                    placeholder="e.g. Lux Tee, Silk Shampoo"
                                    value={promptData.product_name}
                                    onChange={e => updateField('product_name', e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                                    Brand Name
                                </Label>
                                <Input
                                    placeholder="e.g. Crossfly, The Wig Outlet"
                                    value={promptData.brand_name}
                                    onChange={e => updateField('brand_name', e.target.value)}
                                    className="h-9"
                                />
                            </div>
                        </div>

                        {/* Row 2: Audience */}
                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                                Target Audience
                            </Label>
                            <Input
                                placeholder="e.g. Women aged 25-40, wig enthusiasts, fitness lovers"
                                value={promptData.target_audience}
                                onChange={e => updateField('target_audience', e.target.value)}
                                className="h-9"
                            />
                        </div>

                        {/* Row 3: Tone + Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                                    Tone
                                </Label>
                                <UISelect
                                    value={promptData.tone}
                                    onValueChange={val => updateField('tone', val)}
                                    className="w-full"
                                    options={TONE_OPTIONS}
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                                    Copy Type
                                </Label>
                                <UISelect
                                    value={promptData.copy_type}
                                    onValueChange={val => updateField('copy_type', val)}
                                    className="w-full"
                                    options={COPY_TYPE_OPTIONS}
                                />
                            </div>
                        </div>

                        {/* Row 3: Image Links */}
                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                                Image Links (comma separated)
                            </Label>
                            <Input
                                placeholder="https://example.com/img1.jpg, https://example.com/img2.jpg"
                                defaultValue={promptData.image_links?.join(', ') || ''}
                                onChange={e => {
                                    const value = e.target.value;
                                    const links = value
                                        .split(',')
                                        .map(link => link.trim())
                                        .filter(link => link.length > 0);
                                    updateField('image_links', links);
                                }}
                                className="h-9"
                            />
                        </div>

                        {/* Row 4: Additional Requirements */}
                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                                Additional Requirements
                            </Label>
                            <Textarea
                                placeholder="e.g. Mention Easter sale, keep under 100 words, include a discount code SAVE20, mention free shipping..."
                                value={promptData.additional_requirements}
                                onChange={e => updateField('additional_requirements', e.target.value || '')}
                                rows={3}
                                className="resize-none"
                            />
                        </div>

                        {/* Generate Button */}
                        <Button
                            onClick={handleGenerate}
                            disabled={generating || !promptData.product_name.trim()}
                            className="w-full h-10 bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white shadow-md shadow-violet-500/20 gap-2"
                        >
                            {generating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating Copy...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    Generate Copy
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* ─── RESULT VIEW ─── */}
                {view === 'result' && currentCopy && (
                    <div className="space-y-4">

                        {/* Copy Display */}
                        <CopyDisplayCard
                            content={currentCopy.generated_content}
                            iterationCount={currentCopy.iteration_count}
                        />

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleEditPrompt}
                                className="gap-1.5"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Edit Prompt
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRegenerate}
                                disabled={generating}
                                className="gap-1.5"
                            >
                                {generating ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                Regenerate
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleClose}
                                className="ml-auto gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                            >
                                ✅ Use This Copy
                            </Button>
                        </div>
                    </div>
                )}

                {/* ─── HISTORY VIEW ─── */}
                {view === 'history' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                <History className="h-4 w-4 text-violet-500" />
                                Previous Copies
                            </h4>
                            <span className="text-xs text-muted-foreground">{copies.length} generation{copies.length !== 1 ? 's' : ''}</span>
                        </div>

                        {fetchingList ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                                <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                                Fetching history...
                            </div>
                        ) : copies.length === 0 ? (
                            <div className="text-center py-10 border border-dashed rounded-lg bg-muted/20">
                                <p className="text-sm text-muted-foreground">No copies generated for this task yet.</p>
                                <Button variant="outline" size="sm" className="mt-3" onClick={() => setView('prompt')}>
                                    Generate One Now
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                                {copies?.map((copy) => {
                                    const isExpanded = expandedHistoryId === copy.id;
                                    return (
                                        <div key={copy.id} className="border border-border rounded-lg bg-card overflow-hidden transition-all">
                                            <button
                                                className="w-full flex items-center justify-between p-3.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                                                onClick={() => setExpandedHistoryId(isExpanded ? null : copy.id)}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                                                    Copy Generated on {new Date(copy.created_at).toLocaleString()}
                                                </span>
                                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isExpanded && (
                                                <div className="p-3 border-t border-border bg-muted/5 animate-in slide-in-from-top-2 fade-in duration-200">
                                                    <CopyDisplayCard
                                                        content={copy.generated_content}
                                                        iterationCount={copy.iteration_count}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Loading overlay for result view regeneration */}
                {view === 'result' && generating && (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                        Regenerating copy...
                    </div>
                )}
            </div>
        </div>
    );
}
