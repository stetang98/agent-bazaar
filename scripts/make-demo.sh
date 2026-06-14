#!/usr/bin/env bash
# Agent Bazaar demo video helper.
#   make-demo.sh narration          -> generate English voiceover (TTS) + subtitles + timing sheet
#   make-demo.sh mux <video> [out]  -> mux voiceover + burn subtitles onto your screen recording
# Output dir: ~/Desktop/agent-bazaar-demo
set -euo pipefail

MODE="${1:-narration}"
OUT="$HOME/Desktop/agent-bazaar-demo"
VOICE="${VOICE:-Evan (Enhanced)}"   # override: VOICE="Samantha" ./make-demo.sh narration
GAP="${GAP:-1.2}"                    # seconds of silence between beats
mkdir -p "$OUT"

# Spoken text (phonetic, so TTS pronounces ERC-8004 / x402 / USDC correctly)
SPOKEN=(
"AI agents are exploding, but they can't discover each other, pay each other, or build trust, without humans, accounts, or K Y C. Agent Bazaar is the on-chain marketplace that fixes that, on Arbitrum."
"We use the two standards this buildathon ran workshops on. E R C eighty oh four, for on-chain agent identity and reputation, and x four oh two, for per-call stablecoin payments. Wired into one working product."
"Every agent here is read live from chain. Each card is an E R C eighty oh four identity. Its profile from the on-chain agent U R I, its rating from the reputation contract. No database. It's all on Arbitrum."
"I'll paste a vulnerable vault contract, and click, Audit, pay ten cents in U S D C."
"Watch this. The buyer signs a gasless authorization, not a transaction. No gas, just approval to pull ten cents of U S D C. Under the hood it's E I P three thousand and nine. Our self-hosted x four oh two facilitator submits it, and the escrow contract pulls the funds atomically, and emits an on-chain receipt."
"Seconds later, the audit comes back. It correctly flags the reentrancy, and the unchecked low-level call. And this link is the on-chain settlement transaction."
"After using it, I rate it, an on-chain transaction, and reputation updates instantly. Now I filter to verified buyers only. Reputation counts only addresses with an on-chain payment receipt. Sybil-resistant reputation, built on the standard's own primitive, plus on-chain payment proof."
"Three things. One. Both primitives, used deeply. Not a toy. Two. Settlement is trustless. We settle into a contract, atomically. Three. Contract quality. Three contracts, thirty seven tests including fuzzing, and a dual code review that caught and fixed a critical fund theft bug before deploy."
"Agents need identity, payments, and trust. Agent Bazaar is all three. Live on Arbitrum. The infrastructure is here. Bring your agents."
)
# Subtitle text (proper display spelling)
SUB=(
"AI agents can't discover, pay, or trust each other — no humans, accounts, or KYC. Agent Bazaar fixes that, on Arbitrum."
"Two standards: ERC-8004 (on-chain identity + reputation) and x402 (per-call stablecoin payments) — one product."
"Every agent read live from chain: ERC-8004 identity, on-chain agentURI profile, reputation-contract rating. No database."
"Paste a vulnerable contract, then Audit — pay \$0.10 USDC."
"The buyer signs a gasless authorization — not a tx, no gas. EIP-3009: our x402 facilitator settles atomically into PaymentEscrow."
"Audit flags the reentrancy + unchecked call. This link is the on-chain settlement tx."
"Rate on-chain -> reputation updates. 'Verified buyers only' filters to on-chain payers — sybil-resistant."
"Both primitives, deeply · trustless contract settlement · 37 tests + dual review that caught a CRITICAL bug pre-deploy."
"Agents need identity, payments, trust. Agent Bazaar is all three — live on Arbitrum. Bring your agents."
)

srt_ts() { awk -v s="$1" 'BEGIN{h=int(s/3600);m=int((s-h*3600)/60);x=s-h*3600-m*60;printf "%02d:%02d:%06.3f",h,m,x}' | sed 's/\./,/'; }

gen_narration() {
  rm -f "$OUT"/beat_*.aiff "$OUT"/narration.* "$OUT"/demo.srt "$OUT"/concat.txt "$OUT"/gap.aiff
  ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t "$GAP" "$OUT/gap.aiff" -loglevel error
  : > "$OUT/concat.txt"; : > "$OUT/demo.srt"
  echo "file 'gap.aiff'" >> "$OUT/concat.txt"
  local t="$GAP" idx=0
  echo "── 分镜时间表(录屏时按这个节奏操作)──"
  for i in "${!SPOKEN[@]}"; do
    say -v "$VOICE" -o "$OUT/beat_$i.aiff" "${SPOKEN[$i]}"
    local dur start end
    dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/beat_$i.aiff")
    start="$t"; end=$(awk -v a="$t" -v b="$dur" 'BEGIN{printf "%.3f",a+b}')
    idx=$((idx+1))
    printf "%d\n%s --> %s\n%s\n\n" "$idx" "$(srt_ts "$start")" "$(srt_ts "$end")" "${SUB[$i]}" >> "$OUT/demo.srt"
    echo "file 'beat_$i.aiff'" >> "$OUT/concat.txt"; echo "file 'gap.aiff'" >> "$OUT/concat.txt"
    t=$(awk -v a="$end" -v g="$GAP" 'BEGIN{printf "%.3f",a+g}')
    printf "  beat %d  起 %5.1fs  时长 %4.1fs  | %s\n" "$idx" "$start" "$dur" "${SUB[$i]}"
  done
  ( cd "$OUT" && ffmpeg -y -f concat -safe 0 -i concat.txt -c:a aac -b:a 160k narration.m4a -loglevel error )
  echo "──"
  echo "总时长: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/narration.m4a")s"
  echo "配音: $OUT/narration.m4a"
  echo "字幕: $OUT/demo.srt"
}

do_mux() {
  local vid="$1" final="${2:-$OUT/agent-bazaar-demo-final.mp4}"
  [ -f "$vid" ] || { echo "找不到视频: $vid"; exit 1; }
  [ -f "$OUT/narration.m4a" ] || { echo "请先跑: make-demo.sh narration"; exit 1; }
  ffmpeg -y -i "$vid" -i "$OUT/narration.m4a" \
    -vf "subtitles='$OUT/demo.srt':force_style='Fontsize=16,Outline=2,Shadow=0,MarginV=36'" \
    -map 0:v:0 -map 1:a:0 -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 20 -c:a aac -shortest "$final" -loglevel error
  echo "成片: $final"
}

case "$MODE" in
  narration) gen_narration ;;
  mux) shift; do_mux "$@" ;;
  *) echo "用法: make-demo.sh narration | make-demo.sh mux <video> [out.mp4]"; exit 1 ;;
esac
