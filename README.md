# GL-3DPRT-SP/S 全路径动力学模拟

双击 `index.html` 即可离线运行，也可通过任意静态 HTTP 服务打开。

数据由 `scripts/build-dynamics-animation.py` 从正式 nominal jerk 全路径 CSV 生成；公共数据与四种 IK 元数据写入 `data.js`；各算法、各工况时程分别写入带内容哈希的 `chunks/<algorithm>-<scenario>.<hash>.js`，网页仅在需要时加载，以缩短首屏等待并满足 Cloudflare Pages 的 25 MiB 单文件限制。
页面启动后仅按 `scenarioAssets` 映射加载默认强姿态解析 φ / XY 200、Z 50 mm/s 数据块；切换算法或 TCP 工况时再加载相应数据块。
正式图层为当前参数计算包络；58点资料仅记录为 `unverified_reference`，不参与路径或正式图层。
高位不相连可行区间单独标为“隔离区间”；路径只沿与底层连续相通的分量上升，不跨越空洞。
算法下拉包含局部贪心、平衡姿态、强姿态三种解析对照方案及实际凌蛛IK；实际凌蛛IK使用臂1延迟释放 Active DLS 预测并投影到严格解析可行姿态。四者均命中同一 TCP 路径并使用相同当前参数口径。
实际凌蛛IK 为保持连续物理可行性采用了 9 个已记录的空间步长安全降级关节步；网页仅在该数值大于零时以红字提示，TCP、关节硬限位、电缸行程和固定连杆分支仍逐帧校验。
详细数值和原因说明见 `algorithm-comparison.md`，对比图见 `algorithm-comparison.png`。
电机扭矩为 η=1 的最不利单电机轴等效需求理论下限；不是厂家最终选型扭矩。
新硬件额定/最大转矩来自用户提供的厂家表；额定转矩虚线为 6.36/6.36/4.90 N·m。最大转矩只作低速短时边界记录，不与6000 rpm组合使用。
新硬件η=1理论额定推力为59.942/59.942/30.788 kN，实际电缸持续推力、综合效率和结构限值仍为 unknown_pending_supplier_data。
右侧所有工况、硬件组和臂共用固定量程：扭矩 0～7 N·m，电缸线速度 -140～140 mm/s。

## 生成校验

- 局部贪心 · XY / Z 150 mm/s: samples=25145, duration=1225.9938s, cylinder speed peaks=66.124,52.638,55.064 mm/s
-   旧: eta=1 motor torque peaks=1.490,1.968,1.465 Nm
-   新: eta=1 motor torque peaks=1.590,2.099,1.465 Nm
- 局部贪心 · XY / Z 200 mm/s: samples=19260, duration=934.0072s, cylinder speed peaks=88.040,70.174,73.288 mm/s
-   旧: eta=1 motor torque peaks=1.524,2.000,1.499 Nm
-   新: eta=1 motor torque peaks=1.625,2.134,1.499 Nm
- 局部贪心 · XY 200 / Z 50 mm/s: samples=21019, duration=1024.0707s, cylinder speed peaks=88.040,70.174,73.288 mm/s
-   旧: eta=1 motor torque peaks=1.524,2.000,1.409 Nm
-   新: eta=1 motor torque peaks=1.625,2.134,1.409 Nm
- 平衡姿态 · XY / Z 150 mm/s: samples=25145, duration=1225.9938s, cylinder speed peaks=57.572,47.088,31.782 mm/s
-   旧: eta=1 motor torque peaks=1.491,1.964,1.460 Nm
-   新: eta=1 motor torque peaks=1.590,2.095,1.460 Nm
- 平衡姿态 · XY / Z 200 mm/s: samples=19260, duration=934.0072s, cylinder speed peaks=75.817,62.805,42.394 mm/s
-   旧: eta=1 motor torque peaks=1.524,1.996,1.499 Nm
-   新: eta=1 motor torque peaks=1.626,2.129,1.499 Nm
- 平衡姿态 · XY 200 / Z 50 mm/s: samples=21019, duration=1024.0707s, cylinder speed peaks=75.817,62.805,42.394 mm/s
-   旧: eta=1 motor torque peaks=1.524,1.996,1.409 Nm
-   新: eta=1 motor torque peaks=1.626,2.129,1.409 Nm
- 强姿态 · XY / Z 150 mm/s: samples=25145, duration=1225.9938s, cylinder speed peaks=56.650,43.645,23.561 mm/s
-   旧: eta=1 motor torque peaks=1.491,1.964,1.460 Nm
-   新: eta=1 motor torque peaks=1.590,2.095,1.460 Nm
- 强姿态 · XY / Z 200 mm/s: samples=19260, duration=934.0072s, cylinder speed peaks=73.499,58.195,31.416 mm/s
-   旧: eta=1 motor torque peaks=1.525,1.997,1.499 Nm
-   新: eta=1 motor torque peaks=1.626,2.130,1.499 Nm
- 强姿态 · XY 200 / Z 50 mm/s: samples=21019, duration=1024.0707s, cylinder speed peaks=73.499,58.195,31.416 mm/s
-   旧: eta=1 motor torque peaks=1.525,1.997,1.409 Nm
-   新: eta=1 motor torque peaks=1.626,2.130,1.409 Nm
- 实际凌蛛 · XY / Z 150 mm/s: samples=25145, duration=1225.9938s, cylinder speed peaks=68.785,89.920,57.623 mm/s
-   旧: eta=1 motor torque peaks=1.491,1.964,1.635 Nm
-   新: eta=1 motor torque peaks=1.590,2.095,1.635 Nm
- 实际凌蛛 · XY / Z 200 mm/s: samples=19260, duration=934.0072s, cylinder speed peaks=91.710,120.330,75.612 mm/s
-   旧: eta=1 motor torque peaks=1.946,2.159,1.676 Nm
-   新: eta=1 motor torque peaks=2.076,2.303,1.676 Nm
- 实际凌蛛 · XY 200 / Z 50 mm/s: samples=21019, duration=1024.0707s, cylinder speed peaks=91.710,120.330,75.612 mm/s
-   旧: eta=1 motor torque peaks=1.946,2.159,1.593 Nm
-   新: eta=1 motor torque peaks=2.076,2.303,1.593 Nm
