import * as papa from "papaparse"

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

function parseLatLngs(text: string) {
  const lng_lat_strings = text?.replace("LINESTRING", "")
    ?.replace("(", "")
    ?.replace(")", "")
    ?.trim()
    ?.split(",") ?? []
  const lat_lngs: Array<[number, number]> = lng_lat_strings.map((lng_lat_str) => {
    lng_lat_str = lng_lat_str.trim()
    const lng_lat = lng_lat_str.split(" ")
    return [Number(lng_lat[1]), Number(lng_lat[0])]
  })
  return lat_lngs
}

export function useBikeLaneMap(data: string): BikeLaneMap {
  const bike_lane_map: BikeLaneMap = {
    id: "default",
    bike_lanes: {},
  }
  const result = papa.parse(data, {
    header: true,
  })

  const rows = result.data

  rows.forEach((row) => {
    if (!bike_lane_map.bike_lanes[row.CNN]) bike_lane_map.bike_lanes[row.CNN] = []
    const bike_lane: BikeLane = {
      id: row.OBJECTID,
      class: row.FACILITY_T,
      bike_lane_type: row.SYMBOLOGY,
      lat_lngs: parseLatLngs(row.shape),
    }
    bike_lane_map.bike_lanes[row.CNN] = [bike_lane, ...bike_lane_map.bike_lanes[row.CNN]]
  })

  return bike_lane_map
}
