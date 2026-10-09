<template><div ref="element" class="h-72 rounded border border-gray-600" aria-label="Regional sales map"></div></template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import type { RegionCollection, SalesSummary } from '../api/insights';
const props = defineProps<{ regions: RegionCollection; sales: SalesSummary | null; selectedRegion: string }>();
const emit = defineEmits<{ select: [id: string] }>();
const element = ref<HTMLElement | null>(null); let map: L.Map | null = null; let layer: L.GeoJSON | null = null;
function render() {
  if (!map) return; if (layer) map.removeLayer(layer);
  layer = L.geoJSON(props.regions as Parameters<typeof L.geoJSON>[0], {
    style: feature => ({ color: feature?.properties?.regionId === props.selectedRegion ? '#ffd700' : '#693636', weight: 2, fillColor: '#8b5e3c', fillOpacity: 0.5 }),
    onEachFeature: (feature, featureLayer) => {
      const id = String(feature.properties?.regionId ?? '');
      const amount = props.sales?.regions.find(row => row.regionId === id)?.salesCopper;
      const tooltip = document.createElement('span');
      tooltip.textContent = `${String(feature.properties?.name ?? id)}: ${amount === undefined ? 'sales unavailable' : `${amount} copper`}`;
      featureLayer.bindTooltip(tooltip);
      featureLayer.on('click', () => emit('select', id));
    }
  }).addTo(map);
  const bounds = layer.getBounds(); if (bounds.isValid()) map.fitBounds(bounds.pad(0.1));
}
onMounted(() => { if (!element.value) return; map = L.map(element.value, { zoomControl: true }); render(); });
watch(() => [props.regions, props.sales, props.selectedRegion], render);
onBeforeUnmount(() => { map?.remove(); map = null; });
</script>
