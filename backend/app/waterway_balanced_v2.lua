-- Balanced waterway routing profile for OSRM
-- Allows main waterways (river/canal/fairway) but excludes small streams

api_version = 4

function setup()
  return {
    properties = {
      max_speed_for_map_matching = 50,
      weight_name = 'duration',
      process_call_tagless_node = false,
      u_turn_penalty = 20,
      continue_straight_at_waypoint = true,
      use_turn_restrictions = false,
    },

    default_mode = 1,
    default_speed = 10,

    -- Only main navigable waterways (NO stream/ditch/drain)
    waterway_speeds = {
      river = 15,
      canal = 12,
      fairway = 20,
      tidal_channel = 15
      -- REMOVED: stream, ditch, drain (too small for motorboats)
    },

    route_speeds = {
      ferry = 15
    }
  }
end

function process_node(profile, node, result, relations)
  -- Simple node processing
end

function process_way(profile, way, result, relations)
  local waterway = way:get_value_by_key('waterway')
  local route = way:get_value_by_key('route')

  -- Check for waterways
  if waterway and profile.waterway_speeds[waterway] then
    local speed = profile.waterway_speeds[waterway]
    result.forward_speed = speed
    result.backward_speed = speed
    result.forward_mode = 1
    result.backward_mode = 1

    -- Check for one-way
    local oneway = way:get_value_by_key('oneway')
    if oneway == 'yes' or oneway == '1' or oneway == 'true' then
      result.backward_mode = 0
    elseif oneway == '-1' then
      result.forward_mode = 0
      result.backward_mode = 1
    end

    -- Check access restrictions (ONLY explicit prohibitions)
    local access = way:get_value_by_key('access')
    local motor_boat = way:get_value_by_key('motor_boat')
    local motorboat = way:get_value_by_key('motorboat')
    local boat = way:get_value_by_key('boat')

    if access == 'no' or access == 'private' or
       motor_boat == 'no' or motorboat == 'no' or boat == 'no' then
      result.forward_mode = 0
      result.backward_mode = 0
    end

    return
  end

  -- Check for ferry routes
  if route == 'ferry' then
    result.forward_speed = profile.route_speeds.ferry
    result.backward_speed = profile.route_speeds.ferry
    result.forward_mode = 1
    result.backward_mode = 1
    return
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
