# Rate methodology v1

Provider percentage values such as `5.82` normalize to decimal `0.0582`.
Fixed APY holding return over `d` days: `(1+y)^(d/365)-1`.
Floating APR flat-forward projection: `r*d/365`, explicitly labeled and never called locked.
Basis: `fixedComparableRate-floatingComparableRate`; bps = `round(rate*10000)`.
Percentile: `100*count(values<=current)/count(values)`.
Default volatility is standard deviation of rate changes, not rate levels.
