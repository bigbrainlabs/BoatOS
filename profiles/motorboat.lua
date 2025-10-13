-- Enhanced Waterway routing profile for OSRM
-- Optimized for motorboats with depth and access restrictions

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
      max_speed_for_map_matching      = 50/3.6, -- 50kmph for motorboats
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

    -- Minimum depth required for motorboat routing (in meters)
    min_depth_meters          = 1.5,

    -- Minimum bridge clearance (in meters)
    min_clearance_meters      = 2.5,

    -- Waterway types and speeds (km/h) - filtered for motorboat access
    waterway_speeds = {
      river           = 20,
      canal           = 15,
      fairway         = 25,
      tidal_channel   = 20,
      stream          = 0,    -- Too shallow for motorboats
      ditch           = 0,    -- Not navigable
      drain           = 0     -- Not navigable
    },

    route_speeds = {
      ferry = 15
    },

    -- Motorboat access whitelist
    access_tag_whitelist = Set {
      'yes',
      'permissive',
      'designated',
      'boat',
      'motor_boat',
      'motorboat',
      'ship',
      'vessel',
      'commercial'
    },

    access_tag_blacklist = Set {
      'no',
      'private',
      'permit',
      'license',
      'paddling',       -- Paddle-only waterways
      'canoe',          -- Canoe-only waterways
      'kayak'           -- Kayak-only waterways
    },

    -- Motor-specific access restrictions
    motor_blacklist = Set {
      'no_motor',
      'no_motorboat',
      'human',          -- Human-powered only
      'paddle'          -- Paddle-only
    },

    restricted_access_tag_list = Set {
      'private',
      'destination',
      'permit',
      'license'
    },

    restricted_highway_whitelist = Set { },

    construction_whitelist = Set {},

    access_tags_hierarchy = Sequence {
      'motor_boat',
      'motorboat',
      'boat',
      'ship',
      'vessel',
      'access'
    },

    service_tag_forbidden = Set {},

    restrictions = Sequence {
      'boat',
      'motor_boat',
      'motorboat'
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
        'ferry', 'tunnel', 'lock'
    },

    -- classes to support for exclude flags
    excludable = Sequence {
        Set {'ferry'},
        Set {'lock'}
    },
  }
end

function process_node(profile, node, result, relations)
  local lock = node:get_value_by_key("lock")
  local waterway = node:get_value_by_key("waterway")

  -- Mark locks for special handling
  if lock == "yes" or waterway == "lock_gate" then
    result.traffic_lights = true
    result.barrier = true
  end

  -- Mark bridges for clearance checking
  local bridge = node:get_value_by_key("bridge")
  if bridge == "yes" then
    result.barrier = true
  end
end

function process_way(profile, way, result, relations)
  local waterway = way:get_value_by_key('waterway')
  local route = way:get_value_by_key('route')
  local motor = way:get_value_by_key('motor')
  local boat = way:get_value_by_key('boat')

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

  -- Check motor access restrictions first
  if motor and profile.motor_blacklist[motor] then
    result.forward_mode = mode.inaccessible
    result.backward_mode = mode.inaccessible
    return
  end

  -- Check boat-specific motor restrictions
  if boat == "no" or boat == "private" then
    result.forward_mode = mode.inaccessible
    result.backward_mode = mode.inaccessible
    return
  end

  -- Waterways
  if waterway and profile.waterway_speeds[waterway] then
    local speed = profile.waterway_speeds[waterway]

    -- Skip waterways with zero speed (too shallow/not navigable)
    if speed == 0 then
      result.forward_mode = mode.inaccessible
      result.backward_mode = mode.inaccessible
      return
    end

    -- Check depth restrictions
    local depth = tonumber(way:get_value_by_key('depth'))
    local maxdepth = tonumber(way:get_value_by_key('maxdepth'))

    if depth and depth < profile.min_depth_meters then
      -- Too shallow for motorboat
      result.forward_mode = mode.inaccessible
      result.backward_mode = mode.inaccessible
      return
    end

    if maxdepth and maxdepth < profile.min_depth_meters then
      -- Maximum depth too shallow
      result.forward_mode = mode.inaccessible
      result.backward_mode = mode.inaccessible
      return
    end

    -- Check bridge clearance
    local bridge = way:get_value_by_key('bridge')
    if bridge == "yes" then
      local maxheight = tonumber(way:get_value_by_key('maxheight'))
      local clearance = tonumber(way:get_value_by_key('maxheight:physical'))

      if maxheight and maxheight < profile.min_clearance_meters then
        -- Bridge clearance too low
        result.forward_mode = mode.inaccessible
        result.backward_mode = mode.inaccessible
        return
      end

      if clearance and clearance < profile.min_clearance_meters then
        -- Physical clearance too low
        result.forward_mode = mode.inaccessible
        result.backward_mode = mode.inaccessible
        return
      end
    end

    -- Check CEMT class (European waterway classification)
    -- Class I-VII, where I is smallest and VII is largest
    -- Motorboats typically need Class II+ (minimum 1.8m depth)
    local cemt = way:get_value_by_key('CEMT')
    if cemt then
      local cemt_num = tonumber(cemt:match("%d+"))
      if cemt_num and cemt_num < 2 then
        -- Class I waterways too small for motorboats
        speed = speed * 0.5  -- Reduce speed significantly
      end
    end

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

    -- Check access tags
    local access = find_access_tag(way, profile.access_tags_hierarchy)
    if access and profile.access_tag_blacklist[access] then
      result.forward_mode = mode.inaccessible
      result.backward_mode = mode.inaccessible
      return
    end

    -- Check commercial/recreational restrictions
    local usage = way:get_value_by_key('usage')
    if usage == "recreational" then
      -- Recreational waterways are fine for motorboats
      -- Keep current speed
    elseif usage == "industrial" or usage == "commercial" then
      -- Commercial waterways - increase priority slightly
      speed = speed * 1.1
      result.forward_speed = speed
      result.backward_speed = speed
      result.forward_rate = speed / 3.6
      result.backward_rate = speed / 3.6
    end

    -- Apply speed limit if specified
    local maxspeed = tonumber(way:get_value_by_key('maxspeed'))
    if maxspeed and maxspeed > 0 then
      result.forward_speed = math.min(speed, maxspeed)
      result.backward_speed = math.min(speed, maxspeed)
      result.forward_rate = result.forward_speed / 3.6
      result.backward_rate = result.backward_speed / 3.6
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
