import { fmtMoney, fmtPct, fmtWeekday, pick, type GuardVerdict, type Lang } from '@topiapause/shared';

export interface Highlight {
  label: string;
  from?: string;
  to: string;
}

/** Exact, engine-derived numbers to show on the counter-offer. */
export function counterHighlights(v: GuardVerdict, lang: Lang): Highlight[] {
  const co = v.counterOffer;
  if (!co) return [];
  const p = co.proposal;
  const m = v.metrics;
  const ev = (id: string) => v.findings.find((f) => f.ruleId === id)?.evidence ?? {};

  if (p.kind === 'subscription') {
    const out: Highlight[] = [
      {
        label: pick(lang, 'แพ็กเกจ', 'Plan'),
        from: `${fmtMoney({ amount: Number(co.diff.price?.from ?? 0), currency: 'THB' })}${pick(lang, '/ปี', '/yr')}`,
        to: `${fmtMoney(p.price)}${pick(lang, '/เดือน', '/mo')}`,
      },
    ];
    if (p.trialDays > 0) out.push({ label: pick(lang, 'ทดลองฟรี', 'Free trial'), to: pick(lang, `${p.trialDays} วัน`, `${p.trialDays} days`) });
    if (m.cap !== undefined) {
      out.push({
        label: pick(lang, 'เฉลี่ยต่อเดือน', 'Per month'),
        from: fmtMoney({ amount: m.monthlyEquivalent ?? 0, currency: 'THB' }),
        to: `${fmtMoney(p.price)} ≤ ${fmtMoney({ amount: m.cap, currency: 'THB' })}`,
      });
    }
    return out;
  }

  if (p.kind === 'stay') {
    const e = ev('STAY_FLEXIBILITY');
    const out: Highlight[] = [
      {
        label: pick(lang, 'ยกเลิก', 'Cancellation'),
        from: pick(lang, 'คืนเงินไม่ได้', 'non-refundable'),
        to: p.freeCancelUntil ? pick(lang, `ฟรีถึง${fmtWeekday(p.freeCancelUntil, lang)}`, `free until ${fmtWeekday(p.freeCancelUntil, lang)}`) : pick(lang, 'คืนเงินได้', 'refundable'),
      },
      {
        label: pick(lang, 'ราคารวมจริง', 'Real total'),
        from: fmtMoney({ amount: Number(co.diff.total?.from ?? m.total ?? 0), currency: 'THB' }),
        to: fmtMoney(p.totalPrice),
      },
    ];
    if (e.premium !== undefined) {
      out.push({
        label: pick(lang, 'จ่ายเพิ่ม', 'Extra cost'),
        to: `+${fmtMoney({ amount: Number(e.premium), currency: 'THB' })} (${fmtPct(Number(e.premiumPct))})`,
      });
    }
    return out;
  }

  const out: Highlight[] = [];
  if (co.diff.amountIn) {
    out.push({
      label: pick(lang, 'จำนวน swap', 'Swap amount'),
      from: fmtMoney({ amount: Number(co.diff.amountIn.from), currency: 'USDT' }),
      to: fmtMoney(p.amountIn, { precise: !Number.isInteger(p.amountIn.amount * 100) }),
    });
  }
  out.push({
    label: pick(lang, 'สิทธิ์อนุมัติ', 'Approval'),
    from: co.diff.approval?.from === 'unlimited' ? pick(lang, 'ไม่จำกัด', 'unlimited') : undefined,
    to: pick(lang, `พอดี ${fmtMoney(p.approval.amount ?? p.amountIn)}`, `exact ${fmtMoney(p.approval.amount ?? p.amountIn)}`),
  });
  if (m.counterSharePct !== undefined && m.postTradeSharePct !== undefined) {
    out.push({ label: `${p.toAsset} ${pick(lang, 'ในพอร์ต', 'share')}`, from: fmtPct(m.postTradeSharePct), to: fmtPct(m.counterSharePct) });
  }
  if (p.approval.expirySec) {
    out.push({
      label: pick(lang, 'หมดอายุ', 'Expires'),
      from: co.diff.expirySec?.from === 'none' ? pick(lang, 'ไม่มีวันหมด', 'never') : undefined,
      to: pick(lang, `${Math.round(p.approval.expirySec / 60)} นาที`, `${Math.round(p.approval.expirySec / 60)} min`),
    });
  }
  return out;
}
