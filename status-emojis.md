# Status Emojis Plan

## Overview
Status emojis are lightweight badges shown next to each player in the leaderboard (similar to the existing streak fire). They highlight recent performance milestones. Emojis are attached to **players**, not matches, and fall into two categories:

1. **State-based emojis** &nbsp;– driven purely by a player's current stats or Elo trajectory. They remain visible as long as the underlying condition is true.
2. **Event-based emojis** &nbsp;– triggered by specific matches. When earned, they persist for the remainder of that calendar day. Event counts accumulate per player for that day (e.g., a 2-goal comeback and a 3-goal comeback render as `🪃 5`).

All badge logic feeds the leaderboard through the stats cache. Event-based awards reset when the daily cache resets (at midnight local time or the next stats recompute).

## State-Based Emojis
| Emoji | Name | Trigger Condition | Stats Needed | Current Support |
| --- | --- | --- | --- | --- |
| 🔥 | Win Streak | `currentStreak.type === 'win'` and `currentStreak.length ≥ 3`. Number = `currentStreak.length`. | `currentStreak` | ✅ already computed |
| ⛰ | Summit | Player is currently at their personal peak Elo and that peak exceeds `STARTING_ELO`. Number = `highestElo` (rounded). | `highestElo`, current Elo (last `eloTrajectory` entry) | ✅ available |
| 🐍 | Snake | Player's most recent run alternated win/loss for ≥ 5 matches. Number = current alternating length. | `currentAlternatingRun` | ✅ implemented |
| 🧗 | Climber | Player has positive net Elo change on ≥ 3 consecutive **played** days (days without matches pause the streak). Number = length of positive-day streak. | `currentPositiveDayRun` derived from daily Elo deltas | ✅ implemented |
| 🐦‍🔥 | Phoenix | Yesterday's net Elo change < 0 and today's change > |yesterday| (strictly greater). Shows once both days exist. Number = today's recovered Elo. | `phoenix` object (`{ isActive, recoveredAmount }`) | ✅ implemented |
| 🩹 | Medic | Player has helped at least the configured number of unique teammates snap loss streaks (teammate had loss streak ≥ threshold before pairing for a win) within the recent lookback window. Number = qualifying teammates count. | `medicTeammatesHelped` | ✅ implemented |
| 🪴 | Gardener | Player has active streak of matches across consecutive weekdays (Mon–Fri only), skipping weekends. Number = weekday streak length. | `gardenerWeekdayStreak` | ✅ implemented |
| Φ | Golden Streak | Player has the configured minimum count of 5:4 wins since their last 4:5 loss. Number = current qualifying streak. | `goldenPhiStreak` | ✅ implemented |

## Event-Based Emojis (reset daily)
| Emoji | Name | Trigger Source | Award Logic | Stats Needed | Current Support |
| --- | --- | --- | --- | --- | --- |
| 🧯 | Streak Extinguisher | Match result | For each opponent pair defeated who entered the match on a win streak ≥ 3, award one extinguisher. If both opponents had such streaks, each winner gains two counts immediately. | `statusEvents.extinguisherCount` | ✅ implemented |
| 🐕 | Underdog | Match result | Winning team started ≥100 Elo below losing team (team avg pre-match). Number = sum of `floor(eloDiff / 100)` per qualifying win that day. | `statusEvents.underdogPointSum` | ✅ implemented |
| 🪃 | Boomerang | Match result | Winning team trailed by ≥2 goals at any point. Number increases by the max deficit erased in that game (e.g., deficits 2 and 3 → +5). | `statusEvents.comebackGoalSum` | ✅ implemented |
| 🦏 | Rhino (Shutout) | Match result | Player wins 5:0 (shutout). Each 5:0 victory adds 1 to the daily count. | `statusEvents.shutoutCount` | ✅ implemented |
| ☕ | Coffee Break | Match result | Winning team finishes the match in under 2 minutes 30 seconds. Each qualifying win adds 1 to the day's tally. | `statusEvents.fastWinCount` | ✅ implemented |
| 🎢 | Rollercoaster | Match result | Win a match whose goal timeline swaps the leading team at least the configured number of times. Each such win adds 1 for the day. | `statusEvents.rollercoasterCount` | ✅ implemented |
| 🐧 | Chill Comeback | Match result | Win 5:4 after trailing the entire match until scoring the last two goals (tie at 4:4, then win). Each occurrence adds 1 for the day. | `statusEvents.chillComebackCount` | ✅ implemented |

## Implementation Notes
- **Data Flow:** `computeAllPlayerStats` will be extended to produce the new state metrics and daily event tallies. These values will be cached in `stats-cache-service` and consumed by `leaderboard-display` for icon rendering.
- **Daily Reset:** Event-based counts depend on the start-of-day timestamp already computed for `dailyEloChange`. Reuse that boundary to zero out per-player event counters when processing matches from previous days.
- **Numbers on Emojis:** Every emoji except pure flags (🧯?) shows a number. For extinguishers, dogs, rhinos, and boomerangs, display the accumulated count for the current day. For state-based ones, show the metric integral to the condition (streak length, alternating run, days climbing, Elo value, etc.).
- **Stats surface:** Event counters live under `stats.statusEvents`, while state-based values (`currentAlternatingRun`, `currentPositiveDayRun`, `phoenix`) sit at the root of each player's stats object for easy consumption by UI components.
- **Edge Cases:**
  - Players with insufficient match history should simply omit the emoji.
  - For alternating streaks, a single repeated result resets the counter.
  - For daily metrics, ensure timezone consistency with existing `dailyEloChange` computation.

This plan keeps the badge logic centralized, clarifies which stats already exist, and identifies the ones we must add before wiring up the UI rendering.
