import type Map from "ol/Map.js"
import Feature from "ol/Feature.js"
import LineString from "ol/geom/LineString.js"
import VectorSource from "ol/source/Vector.js"
import VectorLayer from "ol/layer/Vector.js"
import { Stroke, Style } from "ol/style.js"
import { fromLonLat } from "ol/proj.js"
import Select from "ol/interaction/Select.js"
import { pointerMove } from "ol/events/condition.js"
import Overlay from "ol/Overlay.js"

type BikeLane = {
  id: number
  class: string
  bike_lane_type: string
  lat_lngs: Array<[number, number]>
}

type BikeLaneMap = {
  id: "default"
  bike_lanes: Record<number, Array<BikeLane>>
}

function styleLane(lane: BikeLane, width: number = 2) {
  let color = "#2d72d2" // Default: COBALT3

  if (lane.class === "CLASS I") {
    color = "#29a634" // FOREST2
  } else if (lane.class === "CLASS II") {
    color = "#d99e0b" // ORANGE3
  } else if (lane.class === "CLASS III") {
    color = "#db3737" // VERMILION3
  } else if (lane.class === "CLASS IV") {
    color = "#1f7a24" // FOREST3
  }

  return new Style({
    stroke: new Stroke({
      color: color,
      width: width,
    }),
  })
}

export function useBikeLaneDisplay(
  map: Map,
  bikeLaneMap: BikeLaneMap,
) {
  const bike_lanes = bikeLaneMap.bike_lanes
  const features: Feature[] = []

  Object.keys(bike_lanes).forEach((group_id: string) => {
    bike_lanes[group_id].forEach((lane: BikeLane) => {
      // Convert lat/lng to lon/lat and project to map coordinates
      const coordinates = lane.lat_lngs.map(([lat, lng]) => fromLonLat([lng, lat]))

      const feature = new Feature({
        geometry: new LineString(coordinates),
        lane: lane,
      })

      feature.setStyle(styleLane(lane))
      features.push(feature)
    })
  })

  const vectorSource = new VectorSource({
    features: features,
  })

  const vectorLayer = new VectorLayer({
    source: vectorSource,
    properties: { name: "bike-lanes" },
  })

  // Add hover interaction
  const hoverInteraction = new Select({
    condition: pointerMove,
    style: (feature) => {
      const lane = feature.get("lane")
      return styleLane(lane, 5)
    },
  })

  map.addInteraction(hoverInteraction)

  // Create popup overlay for displaying lane info on click
  const popup = document.createElement("div")
  popup.className = "ol-popup"
  popup.style.cssText =
    "background: white; padding: 10px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); max-width: 300px; font-family: monospace; font-size: 12px; white-space: pre-wrap;"

  const overlay = new Overlay({
    element: popup,
    positioning: "bottom-center",
    stopEvent: false,
    offset: [0, -10],
  })
  map.addOverlay(overlay)

  // Add click handler for popup
  map.on("click", (evt) => {
    const feature = map.forEachFeatureAtPixel(evt.pixel, (feature) => {
      if (feature.get("lane")) return feature
    })

    if (feature) {
      const lane = feature.get("lane")
      popup.innerHTML = `<pre>${JSON.stringify(lane, null, 2)}</pre>`
      overlay.setPosition(evt.coordinate)
    } else {
      overlay.setPosition(undefined)
    }
  })

  return vectorLayer
}
