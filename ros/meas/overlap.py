import sys, json
d = json.load(open(sys.argv[1]))
P = {k: set(v['_pk']) for k, v in d.items()}
def cmp(a, b):
    A, B = P[a], P[b]
    print(f'{a}->{b}: {a} {len(A)}, {b} {len(B)}, common {len(A&B)}, only-{a} {len(A-B)} ({100*len(A-B)/len(A):.1f}%), only-{b} {len(B-A)}')
for a, b in [('humble','jazzy'),('jazzy','kilted'),('jazzy','lyrical'),('humble','lyrical'),('foxy','humble'),('noetic','humble'),('melodic','noetic')]:
    cmp(a, b)
# sample of well-known packages in humble missing in jazzy
miss = sorted(P['humble'] - P['jazzy'])
print('sample humble-only:', [m for m in miss if any(s in m for s in ('moveit','nav2','gazebo','ignition','ros_ign','realsense','ur_','franka','control','slam'))][:40])
for k in ['moveit','nav2_bringup','ros2_control','ros_gz','gazebo_ros_pkgs','gazebo_ros','realsense2_camera','ur_robot_driver','franka_ros2','slam_toolbox','rviz2','rosbag2','tf2_ros','rclcpp','rclpy','micro_ros_agent','isaac_ros_common','rmw_zenoh_cpp','rmw_cyclonedds_cpp','rmw_fastrtps_cpp','rmw_connextdds','mcap_vendor','foxglove_bridge']:
    print(k, {dd: (k in P[dd]) for dd in ['noetic','foxy','humble','jazzy','kilted','lyrical','rolling']})
