'use client';

import { useState, useEffect } from 'react';
import { Shield, Loader2, Check } from 'lucide-react';
import { savePsychologistConsent } from '@/app/diary/actions/consent';
import { toast } from 'sonner';

export function PsychologistConsentModal({ isOpen: initialOpen }: { isOpen: boolean }) {
    const [isOpen, setIsOpen] = useState(initialOpen);
    const [pdnAccepted, setPdnAccepted] = useState(false);
    const [adsAccepted, setAdsAccepted] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setIsOpen(initialOpen);
    }, [initialOpen]);

    if (!isOpen) return null;

    const handleAccept = async () => {
        if (!pdnAccepted) return;

        setSaving(true);
        try {
            await savePsychologistConsent({
                pdnAccepted,
                adsAccepted,
                userAgent: navigator.userAgent
            });
            setIsOpen(false);
            toast.success('Согласие успешно сохранено');
        } catch (error) {
            console.error(error);
            toast.error('Произошла ошибка при сохранении согласия');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-lg rounded-3xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                        <Shield className="w-8 h-8" />
                    </div>

                    <h2 className="text-2xl font-bold text-foreground mb-3">
                        Правовая информация
                    </h2>
                    <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                        В соответствии с требованиями Федерального закона № 152-ФЗ «О персональных данных», для продолжения использования сервиса Compas необходимо предоставить согласие на обработку ваших персональных данных.
                    </p>

                    <div className="space-y-4 mb-8">
                        {/* PDn Consent (Required) */}
                        <label className="flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer group bg-card hover:bg-muted/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary/5" data-state={pdnAccepted ? 'checked' : 'unchecked'}>
                            <div className="flex items-center h-6">
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={pdnAccepted}
                                    onChange={(e) => setPdnAccepted(e.target.checked)}
                                />
                                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${pdnAccepted ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                                    }`}>
                                    {pdnAccepted && <Check className="w-4 h-4 text-primary-foreground" />}
                                </div>
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-semibold text-foreground leading-tight">
                                    Согласие на обработку персональных данных <span className="text-destructive">*</span>
                                </p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Я даю согласие сервису Compas на обработку моих персональных данных. Ознакомиться с <a href="#" className="text-primary hover:underline" target="_blank">политикой конфиденциальности</a>.
                                </p>
                            </div>
                        </label>

                        {/* Ads Consent (Optional) */}
                        <label className="flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer group bg-card hover:bg-muted/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary/5" data-state={adsAccepted ? 'checked' : 'unchecked'}>
                            <div className="flex items-center h-6">
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={adsAccepted}
                                    onChange={(e) => setAdsAccepted(e.target.checked)}
                                />
                                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${adsAccepted ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                                    }`}>
                                    {adsAccepted && <Check className="w-4 h-4 text-primary-foreground" />}
                                </div>
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-semibold text-foreground leading-tight">
                                    Согласие на получение рассылок
                                </p>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Я хочу получать информацию о новых функциях, обновлениях и специальных предложениях сервиса.
                                </p>
                            </div>
                        </label>
                    </div>

                    <div className="pt-2 border-t border-border/50">
                        <button
                            onClick={handleAccept}
                            disabled={!pdnAccepted || saving}
                            className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center ${!pdnAccepted || saving
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] shadow-sm'
                                }`}
                        >
                            {saving ? (
                                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Сохранение...</>
                            ) : (
                                'Подтвердить и продолжить'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
