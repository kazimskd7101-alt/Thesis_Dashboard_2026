# Version 7 Citation and Source Alignment Changelog

## Critical fixes

1. **Corrected Appendix D / Table XIII source mapping.**
   - Fixed the off-by-one table-numbering problem from Table V onward.
   - Added the correct Table V mapping for the Decision Support Studio functions and purposes.
   - Remapped Table VI to full-sample model/benchmark performance.
   - Remapped Table VII to selective tail-rule results.
   - Remapped Table VIII to Option B strict-finalist and selected comparator results.
   - Remapped Table IX to numeric, momentum, HOG, and HAAR baseline comparison.
   - Remapped Table X to the Grad-CAM selected-case export summary.
   - Added explicit rows for Table XI, Table XII, Table XIII, Table XIV, and Figures 1-10.

2. **Corrected Grad-CAM reliability citation cluster.**
   - Replaced the weaker reliability citation cluster that included Grad-CAM++ as a reliability/caution source.
   - New wording cites Grad-CAM as a post-hoc explanation method and uses XAI/saliency limitation literature for caution: Grad-CAM, sanity checks, Rudin, Guidotti, Adadi and Berrada, Arrieta et al., Lipton, and Miller.

3. **Fixed Future Work abstention/conformal wording.**
   - Removed the uncited conformal-prediction phrase.
   - Replaced it with: calibrated abstention and selective-classification methods.
   - Cited Chow, El-Yaniv and Wiener, and Geifman and El-Yaniv.

## Major fixes

1. **Audited in-text citation support.**
   - Re-Imag remains the central benchmark for chart-image learning.
   - Financial ML and validation-risk statements are supported by López de Prado and Bailey/López de Prado references.
   - Intraday/high-frequency claims remain supported by O'Hara, DeepLOB, CNN LOB, SVM LOB, and Sirignano/Cont sources.
   - Time-series representation claims remain supported by Wang/Oates, Fawaz, InceptionTime, ROCKET, hctsa, shapelets, DTW/DBA, and related sources.
   - XAI claims remain supported by Grad-CAM/CAM/Grad-CAM++, XAI surveys, saliency sanity checks, Rudin, Lipton, Miller, and related method papers.
   - Decision-support and artifact claims remain supported by design science and human-AI interaction references.

2. **Verified numerical-result consistency.**
   - Preserved all verified empirical results and row counts.
   - No reported model metric, coverage value, selected-row count, Wilson interval, Grad-CAM allocation value, or dashboard/export consistency value was changed.

3. **Recompiled and visually inspected the PDF.**
   - Final PDF opens successfully.
   - Final PDF has 27 pages.
   - Appendix D / Table XIII is visible and now matches the manuscript table numbering.
   - Appendix E / Table XIV remains visible and complete.
   - Grad-CAM discussion uses the corrected citation cluster.

## Moderate fixes

1. Adjusted only citation/source-alignment wording where necessary.
2. Preserved LMS-exact title.
3. Preserved the five-section HSE thesis structure.
4. Preserved AI declaration, reproducibility appendices, GitHub/dashboard links, and HSE project-based FQW compliance mapping.
5. Confirmed no automated-trading, profitability, market-efficiency, or causal Grad-CAM claim was introduced.

## Not changed

- No empirical results changed.
- No equations changed.
- No core thesis story changed.
- No title change.
- No dashboard/XAI conclusion changed.
- No new unverified references were invented.
- No automated trading or profitability claim was added.

## Remaining limitations

- Some low-level implementation fields remain explicitly marked as “not available in the supplied materials” where they are not traceable to the supplied notebooks or result files.
- The exact row-level cause of the one-case discrepancy between dashboard/export recomputation and the canonical Option B grid remains not available in the supplied materials.
- The thesis remains a strong HSE submission manuscript; a separate Q1 journal submission would still benefit from more robustness tests, transaction-cost backtesting, additional regimes/contracts, and selection-adjusted inference.
