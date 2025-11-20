# Waiting Karma System

## Motivation

When new players join mid-session, the current suggestion algorithm favors them because they have zero recent appearances. The waiting karma system keeps track of how long every active player has waited between games and rewards players with higher *karma* when generating pairings. This ensures seating fairness without forcing manual tracking.

## Notation

Let the set of players who either participated in, or were active for, the current session be indexed by $i \in \{1, \dots, N\}$. We process the session matches chronologically and index them by $t \in \{0, \dots, T-1\}$.

| Symbol | Description |
| --- | --- |
| $k_i^t$ | Karma score for player $i$ right **before** match $t$ is evaluated. |
| $w_i^t$ | Attendance weight for player $i$ at match $t$. |
| $W^t$ | Total attendance weight, i.e. $W^t = \sum_i w_i^t$. |
| $p_i^t$ | Participation flag: $1$ if player $i$ plays in match $t$, else $0$. |
| $P^t$ | Number of players in match $t$, i.e. $P^t = \sum_i p_i^t$. Typically $4$ for 2v2 matches but also $2$ for 1v1.

## Attendance weights

The attendance weight captures whether a player was part of the active pool when a match happened:

1. For every match $t$, set $w_i^t = 1$ if player $i$ was active during match $t$, otherwise $0$.
2. If a player becomes active immediately after match $t$ (i.e., $w_i^t = 0$ but $w_i^{t+1} = 1$), increase $w_i^t$ by $0.5$. This gives newcomers partial credit for waiting through the transition match.

This produces three tiers per match: non-active ($0$), newly-active ($0.5$), and active ($1$).

## Karma recurrence

Karma starts at zero for all players:

$$
\forall i: k_i^0 = 0.
$$

For each match, karma updates according to

$$
\begin{aligned}
P^t &= \sum_i p_i^t, \\
W^t &= \sum_i w_i^t, \\
k_i^{t+1} &= k_i^t - p_i^t + \frac{w_i^t \cdot P^t}{W^t}.
\end{aligned}
$$

Interpretation:
- Players who play in match $t$ lose one point of karma ($-p_i^t$).
- All active or waiting players share a fair portion of the match credit through the redistribution term $\frac{w_i^t \cdot P^t}{W^t}$.
- Players who were active but not selected accumulate karma, increasing their likelihood of being picked in the next pairing.

After processing all session matches, we obtain $k_i^T$ for each eligible player. These final scores become the *waiting karma* input for the pairing ranking.

## Integration into scoring

1. Compute waiting karma using the formulas above when `suggestPairing` builds its session view.
2. Replace the previous "plays in session" penalty with a new weight $w_{karma}$ applied to per-player karma totals for the candidate pairing (e.g., sum karma of the four players or prefer pairings that include the highest-karma players).
3. Keep the legacy code path for plays-in-session but set its weight to $0$ so it can be re-enabled if needed.

This approach ensures players who have patiently waited are prioritized without discarding other balancing heuristics (teammate repeats, Elo, side counts, etc.).
