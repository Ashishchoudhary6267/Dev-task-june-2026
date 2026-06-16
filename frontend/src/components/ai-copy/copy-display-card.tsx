'use client';

import React from 'react';
import { GeneratedCopyContent } from '@/lib/types/auth';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui';

interface CopyDisplayCardProps {
    content: GeneratedCopyContent;
    iterationCount?: number;
    onDownload?: () => void;
}

/**
 * Renders a structured email copy in a clean, sectioned card format.
 * Matches the layout from the user's sample images.
 */
export default function CopyDisplayCard({ content, iterationCount, onDownload }: CopyDisplayCardProps) {
    const sections = [
        { label: 'Subject', value: content.subject_line },
        { label: 'Preview Text', value: content.preview_text },
        { label: 'Headline', value: content.headline },
        { label: 'Subheadline', value: content.subheadline },
        { label: 'CTA', value: content.cta_button_text },
        { label: 'Body', value: content.body, isBody: true },
        { label: 'Product Headline', value: content.product_headline },
        { label: 'Closing Section', value: content.closing_section },
        { label: 'Footer', value: content.footer_text },
    ].filter(s => s.value?.trim());

    const handleDownload = () => {
        if (onDownload) {
            onDownload();
            return;
        }
        downloadAsWord(content, iterationCount);
    };

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-linear-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                        <FileText className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-foreground">Generated Copy</h4>
                        {/* {iterationCount && (
                            <p className="text-[10px] text-muted-foreground">Iteration #{iterationCount}</p>
                            )} */}
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="gap-1.5 text-xs h-8 bg-white dark:bg-card hover:bg-violet-50 dark:hover:bg-violet-950/30 border-violet-200 dark:border-violet-800"
                >
                    <Download className="h-3.5 w-3.5" />
                    Download .doc
                </Button>
            </div>

            {/* Copy Sections */}
            <div className="divide-y divide-border/60">
                {sections.map((section, idx) => (
                    <div key={idx} className="px-5 py-3.5 hover:bg-muted/20 transition-colors">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            {section.label}
                        </p>
                        {section.isBody ? (
                            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                {section.value}
                            </div>
                        ) : (
                            <p className="text-sm text-foreground font-medium">{section.value}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}


/**
 * Download the copy as a .doc (Word-compatible HTML).
 * Uses Blob with application/msword MIME type — no external libraries needed.
 */
function downloadAsWord(content: GeneratedCopyContent, iterationCount?: number) {
    const sections = [
        { label: 'Subject', value: content.subject_line },
        { label: 'Preview Text', value: content.preview_text },
        { label: 'Headline', value: content.headline },
        { label: 'Subheadline', value: content.subheadline },
        { label: 'CTA', value: content.cta_button_text },
        { label: 'Body', value: content.body },
        { label: 'Product Headline', value: content.product_headline },
        { label: 'Closing Section', value: content.closing_section },
        { label: 'Footer', value: content.footer_text },
    ].filter(s => s.value?.trim());

    const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <title>AI Generated Copy</title>
            <style>
                body { font-family: Calibri, Arial, sans-serif; padding: 20px; color: #1a1a1a; line-height: 1.6; }
                .section { margin-bottom: 18px; }
                .section-label { font-size: 11px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
                .section-value { font-size: 14px; color: #1a1a1a; }
                .section-value.body { white-space: pre-wrap; }
                .header { font-size: 18px; font-weight: bold; color: #4c1d95; margin-bottom: 6px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
                .meta { font-size: 11px; color: #888; margin-bottom: 20px; }
                hr { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
            </style>
        </head>
        <body>
            <div class="header">AI Generated Copy</div>
            <div class="meta">Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}${iterationCount ? ` · Iteration #${iterationCount}` : ''}</div>
            ${sections.map(s => `
                <div class="section">
                    <div class="section-label">${s.label}</div>
                    <div class="section-value${s.label === 'Body' ? ' body' : ''}">${s.value?.replace(/\n/g, '<br/>') || ''}</div>
                </div>
            `).join('<hr/>')}
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-copy${iterationCount ? `-v${iterationCount}` : ''}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
