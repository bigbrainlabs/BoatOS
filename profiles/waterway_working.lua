-- Waterway routing profile for OSRM
-- Based on car.lua but adapted for boat/ship navigation

api_version = 4

Set = require('lib/set')
Sequence = require('lib/sequence')
Handlers = require("lib/way_handlers")
Relations = require("lib/relations")
find_access_tag = require("lib/access").find_access_tag
limit = require("lib/maxspeed").limit

function setup()
  return {
    properties = {
      max_speed_for_map_matching      = 50/3.6, -- 50kmph for boats
      weight_name                     = 'duration',
      process_call_tagless_node      = false,
      u_turn_penalty                 = 20,
      continue_straight_at_waypoint  = true,
      use_turn_restrictions          = false,
      left_hand_driving              = false,
    },

    default_mode              = mode.ferry,
    default_speed             = 10,
    oneway_handling           = true,

    -- Waterway types and speeds (km/h)
    waterway_speeds = {
      river           = 15,
      canal           = 12,
      fairway         = 20,
      tidal_channel   = 15,
      stream          = 8,
      ditch           = 5,
      drain           = 5
    },

    route_speeds = {
      ferry = 15
    },

    access_tag_whitelist = Set {
      'yes',
      'permissive',
      'designated',
      'boat',
      'motor_boat',
      'ship',
      'vessel'
    },

    access_tag_blacklist = Set {
      'no',
      'private'
    },

    restricted_access_tag_list = Set {
      'private',
      'destination',
    },

    restricted_highway_whitelist = Set { },

    construction_whitelist = Set {},

    access_tags_hierarchy = Sequence {
      'boat',
      'motor_boat',
      'ship',
      'vessel',
      'access'
    },

    service_tag_forbidden = Set {},

    restrictions = Sequence {
      'boat',
      'motor_boat'
    },

    -- List of classes to avoid
    avoid = Set {},

    speeds = Sequence {},

    service_penalties = {},

    route_penalties = {},

    bridge_speeds = {},

    surface_speeds = {},

    tracktype_speeds = {},

    smoothness_speeds = {},

    maxspeed_table_default = {},

    relation_types = Sequence {
      "route"
    },

    -- classify by priority
    classes = Sequence {
        'ferry', 'tunnel'
    },

    -- classes to support for exclude flags
    excludable = Sequence {
        Set {'ferry'}
    },
  }
end

function process_node(profile, node, result, relations)
  local lock = node:get_value_by_key("lock")
  local waterway = node:get_value_by_key("waterway")

  if lock == "yes" or waterway == "lock_gate" then
    result.traffic_lights = true
  end
end

function process_way(profile, way, result, relations)
  local waterway = way:get_value_by_key('waterway')
  local route = way:get_value_by_key('route')

  -- Ferry routes
  if route == "ferry" then
    result.forward_mode = mode.ferry
    result.backward_mode = mode.ferry
    result.forward_speed = profile.route_speeds.ferry
    result.backward_speed = profile.route_speeds.ferry
    result.forward_rate = result.forward_speed / 3.6
    result.backward_rate = result.backward_speed / 3.6
    return
  end

  -- Waterways
  if waterway and profile.waterway_speeds[waterway] then
    local speed = profile.waterway_speeds[waterway]

    result.forward_mode = mode.ferry
    result.backward_mode = mode.ferry
    result.forward_speed = speed
    result.backward_speed = speed
    result.forward_rate = speed / 3.6
    result.backward_rate = speed / 3.6

    -- Check oneway
    local oneway = way:get_value_by_key('oneway')
    if oneway == "yes" or oneway == "1" or oneway == "true" then
      result.backward_mode = mode.inaccessible
    elseif oneway == "-1" then
      result.forward_mode = mode.inaccessible
    end

    -- Check access
    local access = find_access_tag(way, profile.access_tags_hierarchy)
    if access and profile.access_tag_blacklist[access] then
      result.forward_mode = mode.inaccessible
      result.backward_mode = mode.inaccessible
    end
  end
end

function process_turn(profile, turn)
  turn.duration = 0
  turn.weight = 0
end

return {
  setup = setup,
  process_way = process_way,
  process_node = process_node,
  process_turn = process_turn
}
