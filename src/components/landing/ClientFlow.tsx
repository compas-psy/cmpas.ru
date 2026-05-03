'use client';

import { CheckCircle } from 'lucide-react';
import { useReveal } from './useReveal';

function PhoneFrame({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="w-[220px] md:w-[240px] bg-white rounded-[28px] border-2 border-[#E4E9E3] shadow-floating overflow-hidden hover:shadow-[0_20px_50px_rgba(20,32,24,0.12)] transition-shadow duration-500">
                {/* Status bar */}
                <div className="h-7 bg-forest-800 flex items-center justify-between px-4">
                    <span className="text-white/70 text-[9px] font-semibold">9:41</span>
                    <div className="flex gap-1">
                        <div className="w-3 h-2 rounded-sm bg-white/50" />
                        <div className="w-3 h-2 rounded-sm bg-white/50" />
                    </div>
                </div>
                {children}
            </div>
            <div className="mt-3 text-[12px] font-semibold text-[#5F6C64]">{label}</div>
        </div>
    );
}

export default function ClientFlow() {
    const textRef = useReveal();
    const phonesRef = useReveal(0.08);

    return (
        <section id="client-flow" className="py-16 md:py-20 bg-white relative">
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#F7F8F4] to-transparent pointer-events-none" />

            <div className="max-w-[1240px] mx-auto px-5 md:px-8 relative">
                <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
                    {/* Text */}
                    <div ref={textRef} className="landing-reveal lg:max-w-[400px] shrink-0">
                        <h2 className="text-[28px] md:text-[36px] font-bold leading-[1.15] tracking-[-0.015em] text-[#142018] mb-4">
                            Клиенту не&nbsp;нужно разбираться в&nbsp;системе
                        </h2>
                        <p className="text-[15px] md:text-[16px] leading-[1.6] text-[#5F6C64] mb-6">
                            Он получает ссылку от психолога, выбирает удобное время, подтверждает запись и&nbsp;всегда может вернуться к&nbsp;своим встречам.
                        </p>
                        <div className="space-y-3">
                            {[
                                'Без регистрации',
                                'Без установки приложения',
                                'Через ссылку, Telegram MiniApp или MAX',
                            ].map(item => (
                                <div key={item} className="flex items-center gap-2.5">
                                    <CheckCircle className="w-4.5 h-4.5 text-forest-800 shrink-0" />
                                    <span className="text-[14px] font-medium text-[#142018]">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Phone mockups */}
                    <div ref={phonesRef} className="landing-reveal flex-1 flex flex-wrap justify-center gap-5 md:gap-6">
                        <PhoneFrame label="Выбор времени">
                            <div className="p-4">
                                <div className="text-[14px] font-bold text-[#142018] mb-3">Запись на сессию</div>
                                <div className="text-[11px] font-bold text-[#5F6C64] mb-2">Выберите дату</div>
                                <div className="grid grid-cols-7 gap-0.5 mb-3">
                                    {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
                                        <div key={d} className="text-[8px] text-[#5F6C64] text-center font-semibold">{d}</div>
                                    ))}
                                    {[12,13,14,15,16,17,18].map(d => (
                                        <div key={d} className={`text-[10px] text-center py-1 rounded-lg ${
                                            d === 15 ? 'bg-forest-800 text-white font-bold' : 'text-[#142018]'
                                        }`}>{d}</div>
                                    ))}
                                </div>
                                <div className="text-[11px] font-bold text-[#5F6C64] mb-2">Выберите время</div>
                                <div className="grid grid-cols-3 gap-1.5 mb-4">
                                    {['17:00', '18:00', '19:00'].map((t, i) => (
                                        <div key={t} className={`text-center py-2 rounded-xl text-[11px] font-semibold border ${
                                            i === 2 ? 'bg-forest-800 text-white border-forest-800' : 'border-[#E4E9E3] text-[#142018]'
                                        }`}>{t}</div>
                                    ))}
                                </div>
                                <div className="bg-forest-800 text-white text-center py-2.5 rounded-xl text-[12px] font-semibold">Записаться</div>
                            </div>
                        </PhoneFrame>

                        <PhoneFrame label="Подтверждение">
                            <div className="p-4 text-center">
                                <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-3 mt-4">
                                    <CheckCircle className="w-6 h-6 text-forest-800" />
                                </div>
                                <div className="text-[16px] font-bold text-[#142018] mb-4">Вы записаны!</div>
                                <div className="bg-sage-50 rounded-2xl p-4 text-left mb-4">
                                    <div className="space-y-2 text-[12px]">
                                        <div className="flex justify-between">
                                            <span className="text-[#5F6C64]">Дата</span>
                                            <span className="font-semibold text-[#142018]">15 мая, чт</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[#5F6C64]">Время</span>
                                            <span className="font-semibold text-[#142018]">19:00 – 20:00</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[#5F6C64]">Формат</span>
                                            <span className="font-semibold text-[#142018]">Онлайн</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="border border-[#E4E9E3] text-forest-800 text-center py-2 rounded-xl text-[11px] font-semibold">Добавить в календарь</div>
                            </div>
                        </PhoneFrame>

                        <PhoneFrame label="Мои записи">
                            <div className="p-4">
                                <div className="text-[14px] font-bold text-[#142018] mb-3">Мои записи</div>
                                <div className="text-[10px] font-bold text-forest-800 uppercase tracking-wider mb-2">Предстоящие</div>
                                <div className="bg-sage-50 rounded-xl p-3 mb-3">
                                    <div className="text-[13px] font-semibold text-[#142018]">15 мая, 19:00</div>
                                    <div className="text-[11px] text-[#5F6C64] mt-0.5">Онлайн · 50 мин</div>
                                    <div className="flex gap-2 mt-2.5">
                                        <div className="flex-1 text-center py-1.5 border border-[#E4E9E3] rounded-lg text-[10px] font-semibold text-[#5F6C64] bg-white">Перенести</div>
                                        <div className="flex-1 text-center py-1.5 border border-red-200 rounded-lg text-[10px] font-semibold text-red-500 bg-white">Отменить</div>
                                    </div>
                                </div>
                                <div className="mt-4 bg-forest-800 text-white text-center py-2.5 rounded-xl text-[12px] font-semibold">Записаться снова</div>
                            </div>
                        </PhoneFrame>
                    </div>
                </div>
            </div>
        </section>
    );
}
