# Data sources

## Primary: All India Pincode Directory
- Publisher: India Post, via data.gov.in (OGDL-India licence).
- File: `data/location/pincode.csv` (157,126 rows).
- Yields: 36 states/UTs, 737 districts, 19,300 PINs, 156,950 post-office localities after dedupe (176 duplicate rows skipped).

## Curated: `data/location/cities.curated.json`
About 40 major cities mapped to 53 district records. City names are not in the pincode file, so cities are curated manually.

## Limitations (not hidden)
- Localities are post-office areas, not every neighbourhood.
- Only curated cities exist (53 city-district records); 684 of 737 districts have no city. The UI falls back to district → localities.
- No LGD codes are present.
- 4,469 coordinates fall outside India's bounds and 9,020 are missing; they are reported and not stored/fabricated.
- Coverage of all PINs/localities is **not** claimed beyond what this dataset contains.
