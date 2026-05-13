# Version 7 Citation and Source Audit Checklist

## 1. Section-by-section citation alignment

| Manuscript area | Main citation support | Audit result |
|---|---|---|
| Abstract and Introduction | Re-Imag [1], financial ML/deep forecasting [2]-[4], Grad-CAM/XAI caution [5]-[7] | Aligned. Claims are introductory and supported by the cited benchmark/survey/method sources. |
| Relevance and Academic Development | Technical analysis [8], [9], financial ML caution [2], [10], deep/time-series surveys [3], [4], intraday/LOB [11]-[13], representation [14]-[17], XAI [18]-[21], design science [22]-[24] | Aligned. Citations match the taxonomy of the field. |
| Literature-review method | Kitchenham [25] and PRISMA [26] | Aligned. Used to support structured/taxonomy-inspired review, not overclaimed as a full PRISMA systematic review. |
| Financial ML and chart-image prediction | Re-Imag [1], López de Prado [2], Bailey/López de Prado [10], [27], deep finance [28]-[30] | Aligned. Re-Imag remains the methodological anchor. |
| Intraday/high-frequency learning | DeepLOB [11], LOB CNN [12], [32], Sirignano/Cont [13], O'Hara [31], SVM LOB [33] | Aligned. Supports intraday/microstructure difficulty and deep learning precedent. |
| Time-series representation and visual baselines | Wang/Oates [14], [35], recurrence plots [34], Sezer/Ozbayoglu [36], Fawaz/InceptionTime/ROCKET [15]-[17], hctsa/shapelets/DTW/DBA [37]-[42], HOG [44], HAAR [45] | Aligned. HOG and HAAR discussions cite the correct computer-vision sources. |
| XAI and saliency limitations | Grad-CAM/CAM/Grad-CAM++ [5], [46], [47], XAI surveys [18]-[21], saliency sanity checks [6], Rudin [7], Lipton [58], Miller [59], related methods [48]-[57] | Aligned after v7 fix. Reliability/caution language now cites appropriate limitation and survey sources. |
| KOSPI 200 futures CNN + Grad-CAM precedent | Kim et al. [60] | Aligned. Treated as applied precedent, not as the main benchmark. |
| Design science and dashboard artifact | Hevner [22], Peffers [23], FEDS [24], Amershi et al. [64] | Aligned. Supports artifact framing and human-AI governance. |
| Selective prediction / abstention | Chow [61], El-Yaniv and Wiener [62], Geifman and El-Yaniv [63] | Aligned. Supports reject-option/selective-classification logic and Future Work wording. |

## 2. Claim-by-claim support summary for major literature claims

- Chart-image CNN adaptation is supported by Re-Imag [1].
- Financial ML caution, leakage/overfitting, and backtest risk are supported by López de Prado [2] and Bailey/López de Prado [10], [27].
- Intraday/high-frequency modeling difficulty is supported by O'Hara [31], DeepLOB [11], CNN LOB [12], [32], SVM LOB [33], and Sirignano/Cont [13].
- Time-series image and classification representation claims are supported by [14]-[17], [34]-[42].
- HOG and HAAR baselines are supported by Dalal/Triggs [44] and Viola/Jones [45].
- Grad-CAM as an audit/explanation method is supported by [5], [46], [47].
- Caution about post-hoc explanations and saliency limitations is supported by [6], [7], [18]-[20], [58], [59].
- Design-science/project artifact framing is supported by [22]-[24].
- Human-in-the-loop governance is supported by [64].
- Selective abstention is supported by [61]-[63].

## 3. Numerical result consistency

Checked and preserved:

- Raw one-minute rows: 775,621.
- Fifteen-minute by-contract candles: 89,628.
- Clean continuous-front rows: 29,926.
- Clean trading dates: 502.
- I60/R20 manifest: 19,249.
- I120/R20 Option B manifest: 18,924.
- Numeric benchmark features: 17,303.
- Package manifest: 51 files.
- Best full-sample CNN: `single_I60_ma0_vol0`, 0.587 accuracy, 0.559 balanced accuracy, 0.126 MCC, 0.580 ROC-AUC.
- Strict finalist: `single_I120_ma0_vol0`, 0.833 accuracy at 2.0% coverage / 54 selected rows, 0.834 balanced accuracy, 0.830 F1, 0.667 MCC.
- Wilson 95% CI: [0.713, 0.910].
- Dashboard/export recomputation: 46/54 = 0.852.
- Canonical formal Option B grid: 45/54 = 0.833.
- Multi-gated OHLC-only selected: 0.796 accuracy, 0.807 balanced accuracy, 0.603 MCC at 2.0% coverage / 54 rows.
- HOG tail baseline: 0.704 accuracy, 0.754 balanced accuracy, 0.455 MCC at 2.0% coverage.
- HAAR-like baseline: 0.574 accuracy, 0.582 balanced accuracy, 0.155 MCC at 5.1% coverage.
- Grad-CAM strict-mask values: average dilated foreground heat 0.142 and average background heat 0.858.
- Selected Grad-CAM export: 54 rows, 27 predicted-up, 27 predicted-down, 29 true-up, 25 true-down, SiU5:1 and SiZ5:53.
- Dashboard master: 404 curated rows, including 54 selected prediction rows.

## 4. Table-source mapping consistency

- Table I through Table XIV now map to the correct manuscript items.
- The previous off-by-one error from Table V onward was corrected.
- Table V now maps to dashboard artifact functions, not full-sample model metrics.
- Table VI now maps to full-sample model/benchmark performance.
- Table VII now maps to selective tail-rule results.
- Table VIII now maps to strict finalist and selected comparators.
- Table IX now maps to numeric/momentum/HOG/HAAR baselines.
- Table X now maps to Grad-CAM/dashboard export consistency.

## 5. Figure-source mapping consistency

- Figure 1: conceptual pipeline.
- Figure 2: Re-Imag alignment.
- Figure 3: raw split examples.
- Figure 4: architecture and checkpoint audit.
- Figure 5: dashboard schematic.
- Figure 6: full-sample benchmark ladder / Table VI.
- Figure 7: selective coverage frontier / Table VII.
- Figure 8: CNN/HOG/HAAR selective comparison / Tables VIII-IX.
- Figure 9: representative Grad-CAM case audit.
- Figure 10: strict foreground/background heat diagnostic.

## 6. Reference list integrity

- No missing citations detected in the final compile.
- No unresolved references detected in the final compile.
- No duplicate labels detected in the final compile.
- No `\nocite` padding detected in the active source.
- Re-Imag remains the central methodological benchmark.
- HOG and HAAR discussions cite Dalal/Triggs and Viola/Jones.
- Human-AI/dashboard governance cites Amershi et al.
- No fabricated citation was added in v7.

## 7. XAI citation correctness

- Grad-CAM method claims cite Grad-CAM/CAM/Grad-CAM++ and related XAI method papers.
- Saliency-map reliability/caution claims now cite sanity checks, XAI surveys, Rudin, Lipton and Miller.
- The final XAI claim remains: chart-anchored but spatially diffuse.
- No causal candle-level interpretation is claimed.

## 8. Selective-abstention citation correctness

- Selective-rule logic is tied to reject-option/selective-classification literature [61]-[63].
- Future Work now says calibrated abstention and selective-classification methods, not uncited conformal prediction.

## 9. HSE compliance table correctness

- Appendix E / Table XIV remains visible and complete.
- It maps HSE project-based FQW 7.5.1-7.5.5 to the appropriate sections.
- No lonely table heading remains.

## 10. Remaining citation/source risks

- Several source file names are included as traceability references in Appendix D but not all raw files are bundled inside the final PDF itself; they remain part of the supplied project/reproducibility materials.
- Some low-level training fields remain marked as “not available in the supplied materials,” which is appropriate because they are not fully traceable.
- The thesis is now citation/source aligned for HSE submission. A separate Q1 journal submission would still require more external validation, robustness testing, transaction-cost backtesting and possibly a journal-specific reference/style conversion.
