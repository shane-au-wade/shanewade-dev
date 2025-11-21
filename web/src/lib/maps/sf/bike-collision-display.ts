import type Map from "ol/Map.js"
import Feature from "ol/Feature.js"
import Point from "ol/geom/Point.js"
import VectorSource from "ol/source/Vector.js"
import VectorLayer from "ol/layer/Vector.js"
import Heatmap from "ol/layer/Heatmap.js"
import { Circle, Fill, Stroke, Style } from "ol/style.js"
import { fromLonLat } from "ol/proj.js"

type CollisionSeverity =
  | "Injury (Severe)"
  | "Injury (Complaint of Pain)"
  | "Injury (Other Visible)"
  | "Fatal"

type Collision = {
  latitude: number
  longitude: number
  collision_severity: CollisionSeverity
  [key: string]: unknown
}

type CollisionData = {
  features?: Collision[]
} | Collision[]

function styleCollision(collision: Collision) {
  const severity: CollisionSeverity = collision.collision_severity
  let color = "#2d72d2" // Default: COBALT3

  if (severity === "Injury (Severe)") {
    color = "#db3737" // RED3
  } else if (severity === "Injury (Complaint of Pain)") {
    color = "#d99e0b" // GOLD3
  } else if (severity === "Injury (Other Visible)") {
    color = "#d99e0b" // ORANGE3
  } else if (severity === "Fatal") {
    color = "#000000" // BLACK
  }

  return new Style({
    image: new Circle({
      radius: 4,
      fill: new Fill({
        color: color,
      }),
      stroke: new Stroke({
        color: color,
        width: 1,
      }),
    }),
  })
}

export function useCollisionsDisplay(
  _map: Map,
  collisionsData: CollisionData,
) {
  const features: Collision[] = Array.isArray(collisionsData) ? collisionsData : collisionsData.features || []

  const markerFeatures: Feature[] = []
  const heatmapFeatures: Feature[] = []

  features.forEach((collision: Collision) => {
    const coordinates = fromLonLat([collision.longitude, collision.latitude])

    // Create marker feature
    const markerFeature = new Feature({
      geometry: new Point(coordinates),
      collision: collision,
    })
    markerFeature.setStyle(styleCollision(collision))
    markerFeatures.push(markerFeature)

    // Create heatmap feature (same data, used for heatmap layer)
    const heatmapFeature = new Feature({
      geometry: new Point(coordinates),
      weight: () => {
        if (collision.collision_severity === "Injury (Severe)") {
          return 0.8
        } else if (collision.collision_severity === "Injury (Complaint of Pain)") {
          return 0.5
        } else if (collision.collision_severity === "Injury (Other Visible)") {
          return 0.5
        } else if (collision.collision_severity === "Fatal") {
          return 1
        }
      },
    })
    heatmapFeatures.push(heatmapFeature)
  })

  // Create markers layer
  const markersSource = new VectorSource({
    features: markerFeatures,
  })

  const markersLayer = new VectorLayer({
    source: markersSource,
    properties: { name: "collision-markers" },
  })

  // Create heatmap layer
  const heatmapSource = new VectorSource({
    features: heatmapFeatures,
  })

  const heatmapLayer = new Heatmap({
    source: heatmapSource,
    blur: 15,
    radius: 7,
    opacity: 0.8,
    weight: () => 1,
    properties: { name: "collision-heatmap" },
  })

  return {
    markersLayer,
    heatmapLayer,
  }
}
