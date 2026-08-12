# Delhi Urban Heat Island Mapping

A remote sensing pipeline that processes Landsat 8 and Sentinel-2 satellite imagery across all 9 districts of Delhi to map surface temperature, vegetation loss, and built-up density — identifying 10 priority locations for Miyawaki afforestation as a heat mitigation strategy.

---

## Architecture

Google Earth Engine (Landsat 8 + Sentinel-2, 2019–2024)
↓
Satellite Indices — LST · NDVI · NDBI
(6 years × 3 indices = 18 rasters + 6 derived)
↓
Google Cloud Storage
├── rasters/   ← 24 GeoTIFF exports
└── results/   ← statistics, plots, sites
↓
Vertex AI Workbench (Python)
├── Pearson correlation (NDVI/NDBI vs LST)
├── Linear regression
├── Change detection (2019 → 2024)
└── Hotspot scoring & site selection
↓
Heat Mitigation Map — 10 Miyawaki forest priority sites


---

## Key Findings

| Metric | Value |
|---|---|
| Study period | April–June, 2019–2024 |
| Mean LST 2024 | 47.6°C (record high) |
| LST increase 2019→2024 | +1.35°C |
| NDVI vs LST correlation | r = -0.48, p < 0.0001 |
| NDBI vs LST correlation | r = +0.67, p < 0.0001 |
| COVID cooling effect (2020–21) | -2.25°C anomaly |
| Priority sites identified | 10 |

---

## Results

### Top 10 Miyawaki Forest Priority Sites

| Site | Latitude | Longitude | LST (°C) | NDVI | Score |
|---|---|---|---|---|---|
| 1 | 28.5819 | 76.8673 | 50.87 | 0.078 | 0.871 |
| 2 | 28.5552 | 77.0842 | 52.44 | 0.011 | 0.841 |
| 3 | 28.5625 | 77.1201 | 52.24 | 0.004 | 0.838 |
| 4 | 28.5892 | 76.8907 | 53.23 | 0.103 | 0.834 |
| 5 | 28.6054 | 76.8921 | 52.90 | 0.168 | 0.832 |
| 6 | 28.5507 | 76.8759 | 53.45 | 0.120 | 0.827 |
| 7 | 28.5981 | 76.8754 | 52.85 | 0.101 | 0.824 |
| 8 | 28.6011 | 76.9069 | 52.79 | 0.087 | 0.822 |
| 9 | 28.6218 | 76.9446 | 52.07 | 0.087 | 0.819 |
| 10 | 28.6143 | 77.2440 | 49.51 | 0.042 | 0.819 |

Hotspot score = `0.4×LST_norm + 0.3×NDBI_norm + 0.3×(1 − NDVI_norm)`

---

## Repository Structure

    UHI-mapping-delhi/
    ├── gee/
    │   └── uhi_gee_script.js
    ├── notebooks/
    │   └── UHI-mapping-delhi.ipynb
    ├── results/
    │   ├── priority_sites.csv
    │   ├── priority_sites.geojson
    │   ├── correlation_results.json
    │   ├── yearly_mean_statistics.csv
    │   ├── yearly_trends.png
    │   ├── correlation_scatter_plots.png
    │   └── priority_sites_map.png
    ├── config.json.example
    ├── .gitignore
    ├── LICENSE
    └── README.md

---

## Setup

```bash
pip install rasterio geopandas numpy pandas scipy matplotlib seaborn google-cloud-storage
```

1. Copy `config.json.example` → `config.json` and add your GCS bucket name
2. Run `gee/uhi_gee_script.js` in Google Earth Engine to export rasters
3. Open `notebooks/UHI-mapping-delhi.ipynb` in Vertex AI Workbench or Jupyter

---

## Stack

Google Earth Engine · Google Cloud Storage · Vertex AI Workbench · Python · rasterio · geopandas · scipy

---

## Limitations

- 30m LST resolution — suitable for district-level analysis, not sub-block
- COVID years (2020–2021) show -2.25°C anomaly due to reduced activity — flagged in analysis
- Site selection does not account for land ownership or legal plantability
- Miyawaki suitability (soil, water access) not assessed remotely

---

## License

- **Code**: [MIT License](LICENSE)
- **Data**: India district boundaries from [DataMeet](https://github.com/datameet/maps), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## Attribution

[India - District Boundaries](https://projects.datameet.org/maps/districts/#india-district-boundaries) by [DataMeet India community](http://datameet.org/), used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
