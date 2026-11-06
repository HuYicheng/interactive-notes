# Arithmetic quoted on page 17 · 第 17 篇里"我们算的"那些数

- `calcnum.py` → `numbers.txt`: every number the page marks as "我们算的 / our arithmetic": the Nav2-style inflation
  costs on the kitchen costmap and NavFn's cell costs; grid search from the dock to the grasp pose (cells expanded by
  Dijkstra, A*, weighted A* and greedy best-first, path lengths and costs); where an illustrative potential field gets
  stuck; how hard a cup of water can be accelerated before it spills, its first slosh mode, and carry times with and
  without a jerk limit; FR3 joint move times at the datasheet limits; DWB's dynamic window and number of candidate
  trajectories; the expected costs of "grasp now" vs "look again"; and the time budget of fetching cup A.
  Run: `python3 calcnum.py > numbers.txt` (needs numpy and scipy).

The kitchen and the robot are fictional; the parts and the software defaults are real (ROS 2 Humble: Nav2, MoveIt 2,
BehaviorTree.CPP 3.8). Numbers marked "示意 / illustrative" on the page are made up for explanation and are not here.

厨房和机器人是虚构的，零件和软件默认值是真实的（ROS 2 Humble：Nav2、MoveIt 2、BehaviorTree.CPP 3.8）。
页面上标"示意"的数是为了讲清楚而编的，不在这里。
